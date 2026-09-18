/**
 * Generate the licence signing key pair.
 *
 *   npm run license:keys
 *
 * Run once per deployment. Put the private key in the server's `.env` as
 * LICENSE_SIGNING_KEY and the public key both there (LICENSE_PUBLIC_KEY) and
 * in the desktop app's `app.config.json`, so every till can verify keys
 * offline.
 *
 * Rotating the pair invalidates every key issued so far, so treat the private
 * key like a database password: back it up, never commit it.
 *
 * This script imports nothing that reads the environment, because it is what
 * you run before the environment is complete.
 */
import { generateLicenseKeyPair } from '../core/license';

const { privateKey, publicKey } = generateLicenseKeyPair();

process.stdout.write(
  [
    '',
    '  Add these to server/.env:',
    '',
    `  LICENSE_SIGNING_KEY=${privateKey}`,
    `  LICENSE_PUBLIC_KEY=${publicKey}`,
    '',
    '  Put the public key (only the public key) in electron/app.config.json as "licensePublicKey".',
    '',
    '  Keep the signing key secret. Rotating it invalidates every licence key already issued.',
    '',
  ].join('\n')
);
