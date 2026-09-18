/**
 * The currency this shop trades in.
 *
 * Each shop picks its own, so a shop in Pakistan prints rupees and a shop in
 * the UK prints pounds. The choice is kept in localStorage on this device, like
 * the other client preferences, and applies to every screen and receipt.
 */
import { create } from 'zustand';

export const CURRENCIES = {
  EUR: { code: 'EUR', label: 'Euro', locale: 'en-IE' },
  GBP: { code: 'GBP', label: 'British pound', locale: 'en-GB' },
  PKR: { code: 'PKR', label: 'Pakistani rupee', locale: 'en-PK' },
  USD: { code: 'USD', label: 'US dollar', locale: 'en-US' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Euro keeps existing installs looking exactly as they did before. */
export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

const STORAGE_KEY = 'pos.currency';

export const isCurrencyCode = (value: unknown): value is CurrencyCode =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, value);

function readCurrency(): CurrencyCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isCurrencyCode(stored) ? stored : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

function writeCurrency(code: CurrencyCode): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // A full or blocked storage must not stop the till from working.
  }
}

interface CurrencyState {
  code: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
}

export const useCurrencyStore = create<CurrencyState>((set) => ({
  code: readCurrency(),
  setCurrency: (code) => {
    if (!isCurrencyCode(code)) return;
    writeCurrency(code);
    set({ code });
  },
}));

// Keep other open tabs of the web app in step when the currency changes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && isCurrencyCode(event.newValue)) {
      useCurrencyStore.setState({ code: event.newValue });
    }
  });
}
