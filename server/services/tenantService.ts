/**
 * Tenant lifecycle: onboarding a company and reading its status.
 *
 * Provisioning is the single entry point for "a new customer signed up",
 * whether they used the public sign up form or the operator onboarded them.
 * It creates the company, its first admin login, a usable default
 * configuration and the opening licence, so the account is ready to take
 * sales immediately.
 */
import { Types } from 'mongoose';
import { withTransaction } from '../config/db';
import { ConflictError, NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import { runAsTenant, withSystemScope } from '../core/tenantContext';
import { CachedTenant, invalidateTenantCache, tenantStatusCache } from '../core/tenantStatusCache';
import Tenant, { ITenant, ITenantLicense, TenantStatus } from '../models/Tenant';
import User, { IUser, hashPassword } from '../models/User';
import Settings, { DEFAULT_EXPENSE_CATEGORIES } from '../models/Settings';
import ExpenseCategory from '../models/ExpenseCategory';
import { LicenseTerm, buildLicense, trialTerm } from './licenseService';
import { revokeAllSessionsForUser } from './tokenService';

export { invalidateTenantCache };

export interface ProvisionTenantInput {
  company: {
    name: string;
    slug?: string;
    contactEmail: string;
    contactPhone?: string;
    plan?: string;
  };
  admin: {
    name: string;
    email: string;
    password: string;
  };
  /**
   * The opening licence. Leave undefined for the configured trial; pass null
   * to create the company locked until the operator issues a key.
   */
  license?: LicenseTerm | null;
}

export interface ProvisionedTenant {
  tenant: ITenant;
  admin: IUser;
}

/** Turn a company name into a URL safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(preferred: string): Promise<string> {
  const base = slugify(preferred) || 'company';
  let candidate = base;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const taken = await Tenant.exists({ slug: candidate });
    if (!taken) return candidate;
    candidate = `${base}-${suffix}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Create a company, its first admin login, its default configuration and its
 * opening licence.
 *
 * Runs as the system because it spans the tenant boundary: the tenant does not
 * exist yet when the first documents are written.
 */
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionedTenant> {
  return withSystemScope(async () => {
    const email = input.admin.email.toLowerCase().trim();

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      throw new ConflictError('That email address already has an account');
    }

    const slug = await uniqueSlug(input.company.slug ?? input.company.name);
    const passwordHash = await hashPassword(input.admin.password);

    // The id is chosen up front so the licence, which is signed over it, can be
    // written in the same insert as the company.
    const tenantId = new Types.ObjectId();
    const term = input.license === undefined ? trialTerm() : input.license;
    const license: ITenantLicense | undefined = term ? buildLicense(tenantId, term) : undefined;

    const result = await withTransaction(async (session) => {
      const [tenant] = await Tenant.create(
        [
          {
            _id: tenantId,
            name: input.company.name.trim(),
            slug,
            contactEmail: (input.company.contactEmail ?? email).toLowerCase().trim(),
            contactPhone: input.company.contactPhone ?? '',
            plan: input.company.plan ?? 'standard',
            status: license?.kind === 'trial' ? 'trial' : 'active',
            license,
          },
        ],
        session ? { session } : {}
      );

      const [admin] = await User.create(
        [
          {
            tenantId: tenant._id,
            name: input.admin.name.trim(),
            email,
            passwordHash,
            role: 'admin',
          },
        ],
        session ? { session } : {}
      );

      await Settings.create(
        [{ tenantId: tenant._id, shopName: tenant.name, shopEmail: tenant.contactEmail }],
        session ? { session } : {}
      );

      await ExpenseCategory.insertMany(
        DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ tenantId: tenant._id, name })),
        session ? { session } : {}
      );

      return { tenant, admin };
    });

    logger.info(
      { tenantId: result.tenant._id.toString(), slug, license: license?.kind ?? 'none' },
      'Tenant provisioned'
    );
    return result;
  });
}

/** Cached status lookup used on every authenticated request. */
export async function getTenantStatus(tenantId: string): Promise<CachedTenant> {
  const cached = tenantStatusCache.get(tenantId);
  if (cached) return cached;

  const tenant = await withSystemScope(() => Tenant.findById(tenantId).select('status name license').lean());
  if (!tenant) throw new NotFoundError('Company');

  const value: CachedTenant = {
    status: tenant.status,
    name: tenant.name,
    licenseExpiresAt: tenant.license?.expiresAt ?? null,
  };
  tenantStatusCache.set(tenantId, value);
  return value;
}

/** Change a company's status and sign every one of its users out on suspension. */
export async function setTenantStatus(
  tenantId: string,
  status: TenantStatus,
  reason = ''
): Promise<ITenant> {
  return withSystemScope(async () => {
    const tenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: { status, statusReason: reason } },
      { returnDocument: 'after' }
    );
    if (!tenant) throw new NotFoundError('Company');

    invalidateTenantCache(tenantId);

    if (status === 'suspended' || status === 'cancelled') {
      const users = await runAsTenant(tenantId, () => User.find().select('_id').lean());
      await Promise.all(users.map((user) => revokeAllSessionsForUser(user._id as Types.ObjectId)));
    }

    return tenant;
  });
}

export async function listTenants(): Promise<ITenant[]> {
  return withSystemScope(() => Tenant.find().sort({ createdAt: -1 }).limit(500));
}
