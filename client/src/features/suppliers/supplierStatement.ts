/**
 * A supplier's ledger statement: every invoice and payment, with the balance
 * owed after each line, worked out from the supplier's invoices.
 */
import { formatMoney } from '../../utils/money';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
export const ROUNDING_TOLERANCE = 0.005;

/** How a supplier was paid, with the words shown for each. */
export const SUPPLIER_PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number]['value'];

export const methodLabel = (method?: string) => SUPPLIER_PAYMENT_METHODS.find((m) => m.value === method)?.label;

/** One payment (or one invoice's share of a payment) made against a supplier invoice. */
export interface SupplierPaymentEntry {
  amount: number;
  remarks?: string;
  paidAt: string;
  /** Shared by the parts of one payment that was spread over several invoices. */
  paymentId?: string;
  method?: SupplierPaymentMethod;
}

export interface SupplierPayment {
  _id: string;
  supplierName: string;
  invoiceNo: string;
  amount: number;
  paid: number;
  date: string;
  remarks?: string;
  /** Every payment, oldest first. Invoices from before this list existed may have none. */
  payments?: SupplierPaymentEntry[];
  lastPaymentAt?: string | null;
  createdAt?: string;
}

/**
 * How to reach a payment when correcting it: by its id, or for one recorded
 * before payments had ids, by its invoice and position on that invoice.
 */
export type PaymentRef = { paymentId: string } | { invoiceId: string; index: number };

/** A line of a supplier's statement: goods received on an invoice, or money paid. */
export interface LedgerEntry {
  key: string;
  at: string;
  /** When the entry was typed in, if different from its business date. */
  recordedAt?: string;
  type: 'Invoice' | 'Payment';
  reference: string;
  details: string;
  /** For a payment spread over several invoices: how much went on each. */
  split?: string;
  remarks: string;
  received: number;
  paid: number;
  balance: number;
  /** The invoice behind an Invoice line. */
  invoice?: SupplierPayment;
  /** The payment behind a Payment line; absent for an "earlier payment" that was never itemised. */
  payment?: { ref: PaymentRef; method?: SupplierPaymentMethod };
}

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

const paymentDetails = (method?: string) => (methodLabel(method) ? `Payment to supplier · ${methodLabel(method)}` : 'Payment to supplier');

/**
 * Every invoice and payment for one supplier, newest first, with the balance
 * owed after each line. A payment spread over several invoices is one line.
 */
export function buildSupplierLedger(invoices: SupplierPayment[]): LedgerEntry[] {
  const lines: Omit<LedgerEntry, 'balance'>[] = [];
  /** Payments by id, so the shares of one payment are joined into one line. */
  const grouped = new Map<string, { line: Omit<LedgerEntry, 'balance'>; parts: { invoiceNo: string; amount: number }[] }>();

  for (const invoice of invoices) {
    lines.push({
      key: `${invoice._id}-invoice`,
      at: invoice.date,
      recordedAt: invoice.createdAt,
      type: 'Invoice',
      reference: invoice.invoiceNo,
      details: 'Goods received',
      remarks: invoice.remarks || '',
      received: Number(invoice.amount) || 0,
      paid: 0,
      invoice,
    });

    const payments = invoice.payments ?? [];
    payments.forEach((payment, index) => {
      const amount = Number(payment.amount) || 0;
      const existing = payment.paymentId ? grouped.get(payment.paymentId) : undefined;
      if (existing) {
        existing.line.paid += amount;
        existing.parts.push({ invoiceNo: invoice.invoiceNo, amount });
        return;
      }
      const line: Omit<LedgerEntry, 'balance'> = {
        key: payment.paymentId ? `payment-${payment.paymentId}` : `${invoice._id}-payment-${index}`,
        at: payment.paidAt,
        type: 'Payment',
        reference: invoice.invoiceNo,
        details: paymentDetails(payment.method),
        remarks: payment.remarks || '',
        received: 0,
        paid: amount,
        payment: {
          ref: payment.paymentId ? { paymentId: payment.paymentId } : { invoiceId: invoice._id, index },
          method: payment.method,
        },
      };
      lines.push(line);
      if (payment.paymentId) grouped.set(payment.paymentId, { line, parts: [{ invoiceNo: invoice.invoiceNo, amount }] });
    });

    // Invoices paid before payments were itemised only kept a running total.
    const itemised = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const untracked = (Number(invoice.paid) || 0) - itemised;
    if (untracked > ROUNDING_TOLERANCE) {
      lines.push({
        key: `${invoice._id}-earlier`,
        at: invoice.lastPaymentAt || invoice.date,
        type: 'Payment',
        reference: invoice.invoiceNo,
        details: 'Payment to supplier',
        remarks: 'Earlier payment (recorded before payment details were kept)',
        received: 0,
        paid: untracked,
      });
    }
  }

  for (const { line, parts } of grouped.values()) {
    line.reference = parts.map((part) => part.invoiceNo).join(', ');
    if (parts.length > 1) line.split = `Split: ${parts.map((part) => `${part.invoiceNo} (${formatMoney(part.amount)})`).join(', ')}`;
  }

  // Oldest first, so the running balance adds up in order; on the same moment an invoice comes first.
  lines.sort((a, b) => {
    const byTime = new Date(a.at).getTime() - new Date(b.at).getTime();
    if (byTime !== 0) return byTime;
    return a.type === b.type ? 0 : a.type === 'Invoice' ? -1 : 1;
  });

  let balance = 0;
  const result = lines.map((line) => {
    balance += line.received - line.paid;
    return { ...line, balance };
  });

  // Most recent first on screen.
  return result.reverse();
}
