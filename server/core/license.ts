/**
 * Licence keys.
 *
 * A licence key is a signed statement: "company T may use the software until
 * E". It is what lets the desktop till decide, with no internet connection,
 * whether it is still allowed to run.
 *
 * Format:
 *
 *   POS1.<payload>.<signature>
 *
 *   payload   = base64url(JSON { t: tenantId, e: expiresAt, i: issuedAt, k: licenceId })
 *   signature = base64url(Ed25519 signature over the payload bytes)
 *
 * The private key lives only on the server (`LICENSE_SIGNING_KEY`). The public
 * key (`LICENSE_PUBLIC_KEY`) ships inside the desktop app, which can verify a
 * key but never mint one. The desktop app carries an identical copy of the
 * verification half of this file in `electron/src/license/licenseKey.ts`; keep
 * the two in step if the format ever changes.
 *
 * Extending a licence produces a new key string, because the expiry is part of
 * what is signed. The `licenceId` stays the same across extensions so a
 * customer's history can be followed.
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

const toSeconds = (date: Date): number => Math.floor(date.getTime() / 1000);

/** Keys are handed around by email and chat, so whitespace is forgiven. */
export const normalizeLicenseKey = (key: string): string => key.replace(/\s+/g, '');

export function signLicenseKey(claims: LicenseClaims, privateKeyBase64: string): string {
  const payload: Payload = {
    t: claims.tenantId,
    k: claims.licenseId,
    i: toSeconds(claims.issuedAt),
    e: toSeconds(claims.expiresAt),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyBase64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const signature = crypto.sign(null, Buffer.from(encodedPayload), privateKey).toString('base64url');

  return `${LICENSE_KEY_PREFIX}.${encodedPayload}.${signature}`;
}

/**
 * Check the signature and unpack the claims. Expiry is deliberately not checked
 * here: callers decide what an expired key means (refuse it, or show when it
 * ran out).
 */
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
    throw new LicenseKeyError('The licence public key is not configured correctly');
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

/** Generate a signing key pair. Used once, by `npm run license:keys`. */
export function generateLicenseKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  return {
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

/**
 * Add calendar months, clamping to the last day of the target month so the
 * 31st of January plus one month is the 28th (or 29th) of February rather than
 * the 3rd of March.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));

  return result;
}

export const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
