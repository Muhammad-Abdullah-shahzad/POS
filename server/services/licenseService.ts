/**
 * Licence lifecycle: issuing, extending, reading and activating.
 *
 * The operator issues or extends a licence by hand once a customer has paid
 * (CLI script or platform endpoint). The result is a signed key that is both
 * stored on the company and handed to the customer, so:
 *
 *   - the web app is unlocked immediately, because every request reads the
 *     licence from the database;
 *   - the desktop till unlocks the next time it is online (it fetches the
 *     licence on sign in and on sync), or straight away when the customer
 *     pastes the key, because it can verify the signature offline.
 *
 * Extending adds time to the current expiry when the licence is still valid,
 * and starts from today when it has already run out. Paying on time is never
 * penalised and paying late never gives free days.
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import { InvalidLicenseKeyError, NotFoundError } from '../core/errors';
import {
  LicenseClaims,
  LicenseKeyError,
  addDays,
  addMonths,
  normalizeLicenseKey,
  signLicenseKey,
  verifyLicenseKey,
} from '../core/license';
import { logger } from '../core/logger';
import { withSystemScope } from '../core/tenantContext';
import { invalidateTenantCache } from '../core/tenantStatusCache';
import Tenant, { ITenant, ITenantLicense, LICENSE_HISTORY_LIMIT, LicenseKind } from '../models/Tenant';

export type LicenseState = 'active' | 'expired' | 'missing';

/** What clients see. The key is included so the desktop till can cache it. */
export interface LicenseStatus {
  state: LicenseState;
  kind: LicenseKind | null;
  issuedAt: string | null;
  expiresAt: string | null;
  /** Whole days until expiry; negative once expired, null when there is no licence. */
  daysLeft: number | null;
  key: string | null;
  message: string;
}

export interface LicenseTerm {
  months?: number;
  days?: number;
  kind?: LicenseKind;
  note?: string;
  /** Start from today even when the current licence has time left. */
  fromNow?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Present a stored licence as a status the clients can act on. */
export function describeLicense(license: ITenantLicense | null | undefined, now = new Date()): LicenseStatus {
  if (!license) {
    return {
      state: 'missing',
      kind: null,
      issuedAt: null,
      expiresAt: null,
      daysLeft: null,
      key: null,
      message: 'No licence has been issued for this company yet.',
    };
  }

  const remainingMs = license.expiresAt.getTime() - now.getTime();
  const daysLeft = Math.floor(remainingMs / DAY_MS);
  const expired = remainingMs <= 0;
  const expiresOn = license.expiresAt.toISOString().slice(0, 10);

  return {
    state: expired ? 'expired' : 'active',
    kind: license.kind,
    issuedAt: license.issuedAt.toISOString(),
    expiresAt: license.expiresAt.toISOString(),
    daysLeft,
    key: license.key,
    message: expired
      ? `The licence expired on ${expiresOn}. Renew it to keep using the app.`
      : `Licence valid until ${expiresOn}.`,
  };
}

/**
 * Build a licence document without saving anything. Used when the licence is
 * inserted together with a brand new company, and by `issueLicense` below.
 */
export function buildLicense(
  tenantId: Types.ObjectId | string,
  term: LicenseTerm,
  current?: ITenantLicense | null,
  now = new Date()
): ITenantLicense {
  const months = term.months ?? 0;
  const days = term.days ?? 0;
  if (months <= 0 && days <= 0) {
    throw new Error('A licence term needs at least one month or one day');
  }

  const currentIsValid = Boolean(current && current.expiresAt.getTime() > now.getTime());
  const from = !term.fromNow && currentIsValid ? current!.expiresAt : now;
  const expiresAt = addDays(addMonths(from, months), days);

  const claims: LicenseClaims = {
    tenantId: tenantId.toString(),
    licenseId: current?.licenseId ?? new Types.ObjectId().toString(),
    issuedAt: now,
    expiresAt,
  };

  return {
    key: signLicenseKey(claims, env.license.signingKey),
    licenseId: claims.licenseId,
    kind: term.kind ?? 'paid',
    issuedAt: now,
    expiresAt,
    note: term.note ?? '',
  };
}

/** Put a licence in force on a company document (does not save). */
function applyLicense(tenant: ITenant, license: ITenantLicense): void {
  if (tenant.license) {
    tenant.licenseHistory.unshift(tenant.license);
    tenant.licenseHistory = tenant.licenseHistory.slice(0, LICENSE_HISTORY_LIMIT);
  }

  tenant.license = license;

  // A paid licence ends the trial; the status is what support tooling lists.
  if (license.kind === 'paid' && tenant.status === 'trial') {
    tenant.status = 'active';
  }
}

/** The default term a newly registered company starts with. */
export const trialTerm = (): LicenseTerm | null =>
  env.license.trialDays > 0 ? { kind: 'trial', days: env.license.trialDays, fromNow: true } : null;

/**
 * Issue or extend a company's licence. Returns the company with the new
 * licence in force; the key to hand to the customer is `tenant.license.key`.
 */
export async function issueLicense(tenantId: string, term: LicenseTerm): Promise<ITenant> {
  return withSystemScope(async () => {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new NotFoundError('Company');

    applyLicense(tenant, buildLicense(tenant._id, term, tenant.license));
    await tenant.save();
    invalidateTenantCache(tenant._id.toString());

    logger.info(
      { tenantId: tenant._id.toString(), slug: tenant.slug, expiresAt: tenant.license!.expiresAt, kind: tenant.license!.kind },
      'Licence issued'
    );

    return tenant;
  });
}

/** Read the current licence status of a company. */
export async function getLicenseStatus(tenantId: string): Promise<LicenseStatus> {
  return withSystemScope(async () => {
    const tenant = await Tenant.findById(tenantId).select('license').lean();
    if (!tenant) throw new NotFoundError('Company');
    return describeLicense(tenant.license);
  });
}

/**
 * Apply a key the customer pasted in.
 *
 * The server already knows every key it issued, so in the normal case this is
 * a no-op that confirms the key. It matters when the database was restored
 * from an older backup, or when a key was issued for a company by hand. A key
 * that is older than the licence already in force is refused rather than
 * silently shortening the customer's time.
 */
export async function activateLicenseKey(tenantId: string, rawKey: string): Promise<LicenseStatus> {
  let claims: LicenseClaims;
  try {
    claims = verifyLicenseKey(rawKey, env.license.publicKey);
  } catch (error) {
    if (error instanceof LicenseKeyError) throw new InvalidLicenseKeyError(error.message);
    throw error;
  }

  if (claims.tenantId !== tenantId) {
    throw new InvalidLicenseKeyError('This licence key was issued to a different company');
  }

  return withSystemScope(async () => {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new NotFoundError('Company');

    const current = tenant.license;
    const key = normalizeLicenseKey(rawKey);

    if (current && current.key === key) return describeLicense(current);

    if (current && current.expiresAt.getTime() >= claims.expiresAt.getTime()) {
      throw new InvalidLicenseKeyError(
        `This key ends on ${claims.expiresAt.toISOString().slice(0, 10)}, but the licence already in force runs longer`
      );
    }

    applyLicense(tenant, {
      key,
      licenseId: claims.licenseId,
      kind: 'paid',
      issuedAt: claims.issuedAt,
      expiresAt: claims.expiresAt,
      note: 'Activated with a pasted key',
    });
    await tenant.save();
    invalidateTenantCache(tenantId);

    logger.info({ tenantId, expiresAt: claims.expiresAt }, 'Licence activated from a key');
    return describeLicense(tenant.license);
  });
}
