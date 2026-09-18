/**
 * Desktop app configuration.
 *
 * The till needs to know two things: where the API lives, and the public key
 * that lets it verify licence keys without a connection. Neither is secret.
 *
 * Values come from, in order of precedence:
 *   1. `electron/.env`         — developer overrides, never packaged
 *   2. `electron/app.config.json` — shipped inside the installer
 *   3. the defaults below
 *
 * The till holds no shared secrets: tokens are issued by the server at sign
 * in, and licence keys are signed by the server. The public key here can only
 * check a key, never create one.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { app } from 'electron';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DEFAULT_API_URL = 'http://localhost:5000/api';

interface AppConfigFile {
  apiBaseUrl?: string;
  licensePublicKey?: string;
}

function readAppConfigFile(): AppConfigFile {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.config.json'), 'utf8')) as AppConfigFile;
  } catch {
    return {};
  }
}

const fileConfig = readAppConfigFile();

export const config = {
  /** Base URL of the POS API, without a trailing slash. */
  apiBaseUrl: (process.env.WEB_API_URL ?? fileConfig.apiBaseUrl ?? DEFAULT_API_URL).replace(/\/+$/, ''),
  /** Base64 SPKI Ed25519 public key matching the server's LICENSE_SIGNING_KEY. */
  licensePublicKey: (process.env.LICENSE_PUBLIC_KEY ?? fileConfig.licensePublicKey ?? '').trim(),
  isPackaged: () => app.isPackaged,
} as const;
