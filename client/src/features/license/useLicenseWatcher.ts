/**
 * Keeps the licence status current while someone is signed in.
 *
 * Checks on sign in, when the window regains focus and on a timer. The desktop
 * check is local and cheap, so it runs every minute — that is what turns an
 * expiry into a locked till even when the shop has no internet. The browser
 * check is a request, so it runs less often; a 402 from any other call locks
 * the app between checks anyway.
 */
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchLicenseStatus } from '../../services/licenseService';

const DESKTOP_INTERVAL_MS = 60 * 1000;
const WEB_INTERVAL_MS = 5 * 60 * 1000;

export function useLicenseWatcher(): void {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (!userId) return;

    const check = () => {
      fetchLicenseStatus().catch(() => undefined);
    };

    check();
    const timer = setInterval(check, window.electronAPI ? DESKTOP_INTERVAL_MS : WEB_INTERVAL_MS);
    window.addEventListener('focus', check);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [userId]);
}
