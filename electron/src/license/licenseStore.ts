/**
 * The licence this till holds, and whether it is still good.
 *
 * The signed key is cached in the local database. Every status check verifies
 * the signature again against the public key baked into the build, checks the
 * key belongs to the company this till is registered to, and compares the
 * expiry with the clock — so the till locks itself when the licence runs out
 * even if it never sees the internet again.
 *
 * Because the check depends on the computer's clock, the latest time the app
 * has ever observed is recorded. A clock that has been wound back past that
 * point is treated as tampering and the till locks until the time is fixed.
 * That is not DRM; it just closes the one obvious loophole.
 */
import { config } from '../config';
import { getDeviceInfo } from '../auth/session';
import { dbGet, dbRun, now } from '../db/database';
import { LicenseClaims, LicenseKeyError, normalizeLicenseKey, verifyLicenseKey } from './licenseKey';

export type DesktopLicenseState = 'active' | 'expired' | 'missing' | 'invalid';

export interface DesktopLicenseStatus {
  state: DesktopLicenseState;
  expiresAt: string | null;
  /** Whole days until expiry; negative once expired, null without a licence. */
  daysLeft: number | null;
  message: string;
  /** When this status was computed, so the renderer can show "checked at". */
  checkedAt: string;
  /** The last few characters of the key in use, shown masked like a card number. */
  keyHint: string | null;
}

const META_LICENSE_KEY = 'licenseKey';
/** The latest wall clock time the app has observed. */
const META_CLOCK_HIGH_WATER = 'clockHighWater';

/** Clock drift the till forgives before calling it tampering. */
const CLOCK_TOLERANCE_MS = 10 * 60 * 1000;
/**
 * How far the clock must advance before the high water mark is saved. Saving
 * rewrites the whole database file and the licence is checked on every data
 * call, so the mark moves in coarse steps. The step is well inside the
 * tolerance, so a wound-back clock is still caught.
 */
const HIGH_WATER_WRITE_STEP_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many trailing characters of the key the activation screen shows. */
const KEY_HINT_LENGTH = 5;

// ── Metadata helpers ────────────────────────────────────────────────────────

function readMeta(key: string): string | null {
  const row = dbGet('SELECT value FROM app_meta WHERE key = $key', { $key: key });
  return (row?.value as string) ?? null;
}

function writeMeta(key: string, value: string): void {
  dbRun(
    `INSERT INTO app_meta (key, value, updatedAt) VALUES ($key, $value, $ts)
     ON CONFLICT(key) DO UPDATE SET value = $value, updatedAt = $ts`,
    { $key: key, $value: value, $ts: now() }
  );
}

// ── Clock guard ─────────────────────────────────────────────────────────────

/**
 * Returns true when the clock has gone backwards further than the tolerance.
 * Advances the high water mark otherwise.
 */
function clockWasWoundBack(currentTime: Date): boolean {
  const recorded = Number(readMeta(META_CLOCK_HIGH_WATER) ?? 0);

  if (currentTime.getTime() + CLOCK_TOLERANCE_MS < recorded) return true;

  if (currentTime.getTime() - recorded > HIGH_WATER_WRITE_STEP_MS) {
    writeMeta(META_CLOCK_HIGH_WATER, String(currentTime.getTime()));
  }
  return false;
}

// ── Status ──────────────────────────────────────────────────────────────────

const status = (
  state: DesktopLicenseState,
  message: string,
  claims?: LicenseClaims,
  currentTime = new Date()
): Omit<DesktopLicenseStatus, 'keyHint'> => ({
  state,
  expiresAt: claims ? claims.expiresAt.toISOString() : null,
  daysLeft: claims ? Math.floor((claims.expiresAt.getTime() - currentTime.getTime()) / DAY_MS) : null,
  message,
  checkedAt: currentTime.toISOString(),
});

/** Verify a key against this build and this till. Throws `LicenseKeyError`. */
function verifyForThisTill(rawKey: string): LicenseClaims {
  if (!config.licensePublicKey) {
    throw new LicenseKeyError('This build of the app has no licence public key configured');
  }

  const claims = verifyLicenseKey(rawKey, config.licensePublicKey);

  const device = getDeviceInfo();
  if (device.tenantId && claims.tenantId !== device.tenantId) {
    throw new LicenseKeyError(`This licence key belongs to a different company than ${device.tenantName}`);
  }

  return claims;
}

export const readStoredLicenseKey = (): string | null => readMeta(META_LICENSE_KEY);

function evaluate(key: string | null, currentTime: Date): Omit<DesktopLicenseStatus, 'keyHint'> {
  if (!key) {
    return status('missing', 'No licence key has been entered on this till yet.', undefined, currentTime);
  }

  let claims: LicenseClaims;
  try {
    claims = verifyForThisTill(key);
  } catch (error) {
    const message = error instanceof LicenseKeyError ? error.message : 'The stored licence key cannot be read';
    return status('invalid', message, undefined, currentTime);
  }

  if (clockWasWoundBack(currentTime)) {
    return status(
      'invalid',
      'The computer clock has been set back. Correct the date and time to continue.',
      claims,
      currentTime
    );
  }

  const expiresOn = claims.expiresAt.toISOString().slice(0, 10);
  if (claims.expiresAt.getTime() <= currentTime.getTime()) {
    return status('expired', `The licence expired on ${expiresOn}. Renew it to keep using the till.`, claims, currentTime);
  }

  return status('active', `Licence valid until ${expiresOn}.`, claims, currentTime);
}

/** The licence status right now, computed from the cached key and the clock. */
export function getLicenseStatus(currentTime = new Date()): DesktopLicenseStatus {
  const key = readStoredLicenseKey();
  return { ...evaluate(key, currentTime), keyHint: key ? key.slice(-KEY_HINT_LENGTH) : null };
}

/**
 * Cache a key on this till. Refuses a key that would cut short a longer
 * licence already held, so a stale key from an old email cannot shorten the
 * customer's time. Throws `LicenseKeyError` when the key cannot be used.
 */
export function storeLicenseKey(rawKey: string): DesktopLicenseStatus {
  const key = normalizeLicenseKey(rawKey);
  const claims = verifyForThisTill(key);

  const existingKey = readStoredLicenseKey();
  if (existingKey && existingKey !== key) {
    try {
      const existing = verifyForThisTill(existingKey);
      if (existing.expiresAt.getTime() > claims.expiresAt.getTime()) {
        throw new LicenseKeyError(
          `This key ends on ${claims.expiresAt.toISOString().slice(0, 10)}, but the licence already on this till runs longer`
        );
      }
    } catch (error) {
      // A stored key that no longer verifies is simply replaced.
      if (error instanceof LicenseKeyError && error.message.startsWith('This key ends on')) throw error;
    }
  }

  writeMeta(META_LICENSE_KEY, key);
  return getLicenseStatus();
}

/**
 * Take whatever licence the server sent along with a sign in or sync. A key
 * that cannot be used is ignored: the server's answer is advisory, the local
 * verification is what counts.
 */
export function storeLicenseFromServer(license: { key?: string | null } | null | undefined): void {
  if (!license?.key) return;

  try {
    storeLicenseKey(license.key);
  } catch (error) {
    console.warn('[Licence] Ignoring the licence sent by the server:', (error as Error).message);
  }
}

export function clearLicense(): void {
  dbRun('DELETE FROM app_meta WHERE key = $key', { $key: META_LICENSE_KEY });
}
