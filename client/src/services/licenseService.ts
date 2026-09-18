/**
 * Reading and activating the licence, on either platform.
 *
 * In the desktop shell the key is verified by the Electron main process, so
 * the till can decide offline. In the browser the server is asked. Both paths
 * land in the same store, which the route guard watches.
 */
import httpClient from './httpClient';
import { licenseStatusFromServer, useLicenseStore } from '../store/licenseStore';
import type { LicenseStatus } from '../store/licenseStore';

export interface ActivationResult {
  success: boolean;
  message: string;
  status: LicenseStatus;
}

const remember = (status: LicenseStatus): LicenseStatus => {
  useLicenseStore.getState().setStatus(status);
  return status;
};

/** Store whatever licence came back with a sign in, from either platform. */
export const rememberLicenseFromSignIn = (license: unknown): void => {
  if (license && typeof license === 'object') remember(licenseStatusFromServer(license as Record<string, unknown>));
};

/** Current status: the cached key on the desktop, the server in the browser. */
export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  if (window.electronAPI) {
    return remember(await window.electronAPI.license.status());
  }

  const { data } = await httpClient.get('/license');
  return remember(licenseStatusFromServer(data.data));
}

/** Ask for the latest licence — after the customer has paid and been renewed. */
export async function refreshLicenseStatus(): Promise<LicenseStatus> {
  if (window.electronAPI) {
    return remember(await window.electronAPI.license.refresh());
  }
  return fetchLicenseStatus();
}

const errorMessage = (error: unknown, fallback: string): string => {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  // No response at all means the request never reached the server.
  if (!response) return 'Could not reach the server. Check the internet connection and try again.';
  return response.data?.message ?? fallback;
};

/** Apply a key the operator sent. */
export async function activateLicense(key: string): Promise<ActivationResult> {
  if (window.electronAPI) {
    const result = await window.electronAPI.license.activate(key);
    return { success: result.success, message: result.message, status: remember(result.data) };
  }

  try {
    const { data } = await httpClient.post('/license/activate', { key });
    const status = remember(licenseStatusFromServer(data.data));
    return { success: status.state === 'active', message: data.message ?? status.message, status };
  } catch (error) {
    return {
      success: false,
      message: errorMessage(error, 'This licence key could not be applied'),
      status: useLicenseStore.getState().status,
    };
  }
}
