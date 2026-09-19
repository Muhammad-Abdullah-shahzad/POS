/**
 * How a sale was paid, normalised for display. Tills have stored the method
 * as "cash", "card", "split" and, in older builds, "SPLIT (Cash: … / Card: …)".
 */
import { PALETTE } from './palette';

export const PAYMENT_METHODS = {
  cash: { label: 'Cash', tone: 'good', color: PALETTE.good },
  card: { label: 'Card', tone: 'brand', color: PALETTE.brand },
  split: { label: 'Split', tone: 'violet', color: PALETTE.violet },
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHODS;

export function paymentMethodKey(method: unknown): PaymentMethodKey {
  const value = String(method ?? 'cash').toLowerCase();
  if (value.startsWith('split')) return 'split';
  return value === 'card' ? 'card' : 'cash';
}

export const paymentMethodOf = (method: unknown) => PAYMENT_METHODS[paymentMethodKey(method)];
