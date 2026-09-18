/**
 * The company's licence, as far as this client knows.
 *
 * Fed by sign in, by the periodic status check and by any 402 the API returns
 * mid-shift. The route guard reads it and sends a locked company to the
 * renewal screen. Persisted so a page reload does not flash the app before
 * the first status check completes.
 */
import { create } from 'zustand';

export type LicenseState = 'active' | 'expired' | 'missing' | 'invalid' | 'unknown';

export interface LicenseStatus {
  state: LicenseState;
  expiresAt: string | null;
  /** Whole days until expiry; negative once expired. */
  daysLeft: number | null;
  message: string;
  kind?: 'trial' | 'paid' | null;
  /** When the status was last computed. */
  checkedAt?: string;
  /** Desktop only: the last server check failed and the local key was used. */
  offline?: boolean;
}

interface LicenseStoreState {
  status: LicenseStatus;
  setStatus: (status: LicenseStatus) => void;
  reset: () => void;
}

const STORAGE_KEY = 'pos.license';

export const UNKNOWN_LICENSE: LicenseStatus = {
  state: 'unknown',
  expiresAt: null,
  daysLeft: null,
  message: 'Licence not checked yet',
};

/** True when the company may not use the app until the licence is renewed. */
export const isLicenseBlocking = (status: LicenseStatus): boolean =>
  status.state === 'expired' || status.state === 'missing' || status.state === 'invalid';

/** True when the admin should be nudged: expired, or ending within a week. */
export const isLicenseWorthShowing = (status: LicenseStatus): boolean =>
  isLicenseBlocking(status) || (status.state === 'active' && status.daysLeft !== null && status.daysLeft <= 7);

function readStatus(): LicenseStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return UNKNOWN_LICENSE;
    const parsed = JSON.parse(raw) as LicenseStatus;
    return parsed?.state ? parsed : UNKNOWN_LICENSE;
  } catch {
    return UNKNOWN_LICENSE;
  }
}

function writeStatus(status: LicenseStatus | null): void {
  try {
    if (status) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(status));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage problems must never stop the till.
  }
}

export const useLicenseStore = create<LicenseStoreState>((set) => ({
  status: readStatus(),

  setStatus: (status) => {
    writeStatus(status);
    set({ status });
  },

  reset: () => {
    writeStatus(null);
    set({ status: UNKNOWN_LICENSE });
  },
}));

const DAY_MS = 24 * 60 * 60 * 1000;

/** Turn a licence object from the API into a status. The key is not kept. */
export function licenseStatusFromServer(payload: Record<string, unknown>): LicenseStatus {
  return {
    state: (payload.state as LicenseState) ?? 'unknown',
    expiresAt: (payload.expiresAt as string | null) ?? null,
    daysLeft: (payload.daysLeft as number | null) ?? null,
    message: (payload.message as string) ?? '',
    kind: (payload.kind as LicenseStatus['kind']) ?? null,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Lock the app after a call was refused because the licence is not in force:
 * a 402 from the server, or the desktop main process refusing an IPC call. The
 * route guard reacts at once, so the cashier lands on the renewal screen
 * instead of a half broken page.
 */
export function lockLicense(
  state: 'expired' | 'missing' | 'invalid',
  message: string,
  expiresAt: string | null = null
): void {
  const current = useLicenseStore.getState().status;
  // Several requests can fail together; one update is enough.
  if (current.state === state && current.message === message) return;

  useLicenseStore.getState().setStatus({
    state,
    expiresAt,
    daysLeft: expiresAt ? Math.floor((Date.parse(expiresAt) - Date.now()) / DAY_MS) : null,
    message,
    checkedAt: new Date().toISOString(),
  });
}
