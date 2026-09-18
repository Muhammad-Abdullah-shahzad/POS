/**
 * Ending a session on this device.
 *
 * Local state is cleared first, so the next person to sign in on a shared till
 * never sees the previous company's cart or licence status. The server session
 * is then revoked on a best effort basis: if the device is offline the refresh
 * token simply expires on its own.
 */
import httpClient from './httpClient';
import { useAuthStore } from '../store/authStore';
import { useLicenseStore } from '../store/licenseStore';
import { usePosStore } from '../store/posStore';

export async function signOutEverywhere(): Promise<void> {
  const refreshToken = useAuthStore.getState().refreshToken;

  usePosStore.getState().clearCart();
  useLicenseStore.getState().reset();
  useAuthStore.getState().signOut();

  try {
    if (window.electronAPI) {
      await window.electronAPI.auth.logout();
    } else if (refreshToken) {
      await httpClient.post('/auth/logout', { refreshToken });
    }
  } catch {
    // Nothing to do: the local session is already gone.
  }
}
