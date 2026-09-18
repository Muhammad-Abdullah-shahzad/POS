/**
 * Licence handling on the till.
 *
 * Three ways a licence reaches this machine:
 *   1. with every sign in or sync, the server sends the current key and it is
 *      cached here — the usual path, and invisible to the customer;
 *   2. a background refresh once an hour, so a renewal made while the till is
 *      running is picked up without anyone doing anything;
 *   3. the customer pastes the key the operator sent them — the path that
 *      works with no internet at all.
 *
 * Whichever way it arrives, the key is verified locally before it is trusted.
 */
import { ipcMain } from 'electron';
import { createServerClient, isNetworkFailure } from '../api/serverClient';
import { LicenseKeyError } from '../license/licenseKey';
import {
  DesktopLicenseStatus,
  getLicenseStatus,
  readStoredLicenseKey,
  storeLicenseFromServer,
  storeLicenseKey,
} from '../license/licenseStore';

export interface RefreshedLicense extends DesktopLicenseStatus {
  /** True when the server could not be reached and the local status was returned. */
  offline: boolean;
}

interface ActivationResult {
  success: boolean;
  message: string;
  data: DesktopLicenseStatus;
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_REFRESH_DELAY_MS = 15 * 1000;

/** Ask the server for the current licence and cache it if it can be used. */
export async function refreshLicenseFromServer(): Promise<RefreshedLicense> {
  const client = createServerClient();
  if (!client) return { ...getLicenseStatus(), offline: false };

  try {
    const response = await client.get('/license', { timeout: 15_000 });
    storeLicenseFromServer(response.data?.data);
    return { ...getLicenseStatus(), offline: false };
  } catch (error) {
    return { ...getLicenseStatus(), offline: isNetworkFailure(error) };
  }
}

/**
 * Tell the server about a key pasted on the till, so the web app and other
 * tills see the same licence. Best effort: the till is already unlocked.
 */
async function reportActivationToServer(key: string): Promise<void> {
  const client = createServerClient();
  if (!client) return;

  try {
    await client.post('/license/activate', { key }, { timeout: 15_000 });
  } catch (error) {
    if (!isNetworkFailure(error)) {
      console.warn('[Licence] Server did not accept the pasted key:', (error as any)?.response?.data?.message);
    }
  }
}

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:status', (): DesktopLicenseStatus => getLicenseStatus());

  ipcMain.handle('license:activate', async (_event, rawKey: string): Promise<ActivationResult> => {
    const key = String(rawKey ?? '').trim();
    if (!key) return { success: false, message: 'Paste the licence key first', data: getLicenseStatus() };

    try {
      const status = storeLicenseKey(key);
      await reportActivationToServer(readStoredLicenseKey() ?? key);

      return {
        success: status.state === 'active',
        message: status.state === 'active' ? 'Licence activated' : status.message,
        data: status,
      };
    } catch (error) {
      const message = error instanceof LicenseKeyError ? error.message : 'This licence key could not be applied';
      return { success: false, message, data: getLicenseStatus() };
    }
  });

  ipcMain.handle('license:refresh', (): Promise<RefreshedLicense> => refreshLicenseFromServer());
}

/** Keep the cached licence current while the app is open. */
export function startLicenseRefreshLoop(): void {
  const refresh = () => {
    refreshLicenseFromServer().catch(() => undefined);
  };

  setTimeout(refresh, FIRST_REFRESH_DELAY_MS).unref();
  setInterval(refresh, REFRESH_INTERVAL_MS).unref();
}
