/**
 * Licence key verification for the desktop till.
 *
 * This is the verification half of `server/core/license.ts`, copied rather
 * than shared because the two are separate packages. Keep the format in step
 * with the server if it ever changes.
 *
 *   POS1.<payload>.<signature>
 *   payload   = base64url(JSON { t: tenantId, e: expiresAt, i: issuedAt, k: licenceId })
 *   signature = base64url(Ed25519 signature over the payload bytes)
 *
 * The till only ever holds the public key, so it can tell a genuine key from
 * a forged one but cannot mint its own.
 */
import crypto from 'crypto';

export const LICENSE_KEY_PREFIX = 'POS1';

export interface LicenseClaims {
  tenantId: string;
  licenseId: string;
  issuedAt: Date;
  expiresAt: Date;
}

/** Thrown when a key cannot be trusted. The message is safe to show a user. */
export class LicenseKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseKeyError';
  }
}

interface Payload {
  t: string;
  k: string;
  i: number;
  e: number;
}

/** Keys are handed around by email and chat, so whitespace is forgiven. */
export const normalizeLicenseKey = (key: string): string => key.replace(/\s+/g, '');

export function verifyLicenseKey(rawKey: string, publicKeyBase64: string): LicenseClaims {
  const key = normalizeLicenseKey(rawKey);
  const [prefix, encodedPayload, signature, ...rest] = key.split('.');

  if (prefix !== LICENSE_KEY_PREFIX || !encodedPayload || !signature || rest.length > 0) {
    throw new LicenseKeyError('This is not a valid licence key');
  }

  let publicKey: crypto.KeyObject;
  try {
    publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
  } catch {
    throw new LicenseKeyError('This build of the app has no valid licence public key');
  }

  const genuine = crypto.verify(
    null,
    Buffer.from(encodedPayload),
    publicKey,
    Buffer.from(signature, 'base64url')
  );
  if (!genuine) throw new LicenseKeyError('This licence key is not genuine');

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new LicenseKeyError('This licence key is damaged');
  }

  if (
    typeof payload.t !== 'string' ||
    typeof payload.k !== 'string' ||
    typeof payload.i !== 'number' ||
    typeof payload.e !== 'number'
  ) {
    throw new LicenseKeyError('This licence key is damaged');
  }

  return {
    tenantId: payload.t,
    licenseId: payload.k,
    issuedAt: new Date(payload.i * 1000),
    expiresAt: new Date(payload.e * 1000),
  };
}
