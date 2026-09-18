/**
 * Device identity and the credentials this till uses to reach the server.
 *
 * Three things live here:
 *
 *   1. The company this device belongs to. A till is claimed by the first
 *      company that signs in on it, and refuses a different one afterwards, so
 *      one shop's offline data can never end up in another shop's account.
 *   2. The tokens issued by the server, encrypted at rest where the operating
 *      system provides a keychain.
 *   3. A local password hash per user, which is what makes offline sign in
 *      possible when the shop's internet is down.
 */
import crypto from 'crypto';
import { safeStorage } from 'electron';
import { dbGet, dbRun, now } from '../db/database';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenantName: string;
}

export interface StoredSession {
  user: StoredUser;
  accessToken: string;
  refreshToken: string;
}

const META_SESSION = 'session';
const META_TENANT_ID = 'tenantId';
const META_TENANT_NAME = 'tenantName';

// ── Metadata table ──────────────────────────────────────────────────────────

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

function deleteMeta(key: string): void {
  dbRun('DELETE FROM app_meta WHERE key = $key', { $key: key });
}

// ── Encryption at rest ──────────────────────────────────────────────────────

/**
 * Encrypt with the OS keychain when it is available. On a machine without one
 * the value is stored as plain text inside the app's own data directory, which
 * is the same protection the local database already has.
 */
function protect(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) return `plain:${value}`;
  return `enc:${safeStorage.encryptString(value).toString('base64')}`;
}

function unprotect(value: string): string | null {
  try {
    if (value.startsWith('plain:')) return value.slice('plain:'.length);
    if (value.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(value.slice('enc:'.length), 'base64'));
    }
    return null;
  } catch {
    // A keychain that can no longer decrypt means the session is unusable.
    return null;
  }
}

// ── Device claim ────────────────────────────────────────────────────────────

export interface DeviceInfo {
  claimed: boolean;
  tenantId: string | null;
  tenantName: string | null;
}

export function getDeviceInfo(): DeviceInfo {
  const tenantId = readMeta(META_TENANT_ID);
  return {
    claimed: Boolean(tenantId),
    tenantId,
    tenantName: readMeta(META_TENANT_NAME),
  };
}

/**
 * Record which company owns this till, or confirm it is already theirs.
 * Returns false when the device belongs to a different company.
 */
export function claimDevice(tenantId: string, tenantName: string): boolean {
  const existing = readMeta(META_TENANT_ID);

  if (existing && existing !== tenantId) return false;

  writeMeta(META_TENANT_ID, tenantId);
  writeMeta(META_TENANT_NAME, tenantName);
  return true;
}

// ── Session ─────────────────────────────────────────────────────────────────

export function saveSession(session: StoredSession): void {
  writeMeta(META_SESSION, protect(JSON.stringify(session)));
}

export function getSession(): StoredSession | null {
  const stored = readMeta(META_SESSION);
  if (!stored) return null;

  const decrypted = unprotect(stored);
  if (!decrypted) return null;

  try {
    return JSON.parse(decrypted) as StoredSession;
  } catch {
    return null;
  }
}

export function updateTokens(accessToken: string, refreshToken: string): void {
  const session = getSession();
  if (!session) return;

  saveSession({ ...session, accessToken, refreshToken });
}

export function clearSession(): void {
  deleteMeta(META_SESSION);
}

// ── Local passwords, for signing in with no connection ──────────────────────

const PBKDF2_ITERATIONS = 210_000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const attempt = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch {
    return false;
  }
}
