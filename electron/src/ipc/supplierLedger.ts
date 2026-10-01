/**
 * Corrections to a supplier's ledger, made from the ledger statement.
 * Mirrors server/services/supplierLedgerService.ts for the till's own data.
 *
 * A supplier is paid as one account: each payment is spread over their oldest
 * unpaid invoices, and every invoice keeps its share under the payment's id.
 * Correcting a payment's amount takes all its shares back and spreads the new
 * amount again: over the invoices it already covered first, then the oldest
 * others, keeping its date, method and remarks.
 * Each invoice's `paid` always equals the sum of its payments. All writes for
 * one correction happen in one transaction and are marked for the next sync.
 */
import { handleLicensed } from '../license/licenseGuard';
import { dbAll, dbGet, dbTransaction, generateLocalId, now } from '../db/database';
import { SUPPLIER_PAYMENT_METHODS } from './supplierInvoices';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const round2 = (value: number): number => Math.round(value * 100) / 100;

interface Payment {
  amount: number;
  paidAt: string;
  remarks?: string;
  paymentId?: string;
  method?: string;
}

interface Invoice {
  _id: string;
  invoiceNo: string;
  supplierName: string;
  amount: number;
  paid: number;
  payments: Payment[];
}

interface Plan {
  id: string;
  paid: number;
  payments: Payment[];
}

const toInvoice = (row: any): Invoice => ({ ...row, amount: Number(row.amount), paid: Number(row.paid), payments: JSON.parse(row.payments || '[]') });

const getInvoice = (_id: string): Invoice | null => {
  const row = dbGet(`SELECT * FROM supplier_invoices WHERE _id = $id AND deletedAt IS NULL`, { $id: _id });
  return row ? toInvoice(row) : null;
};

/** Every live invoice of the supplier holding this payment, oldest first. */
function supplierInvoicesOf(paymentId: string): Invoice[] {
  const rows = dbAll(`SELECT * FROM supplier_invoices WHERE deletedAt IS NULL ORDER BY date ASC, createdAt ASC`).map(toInvoice);
  const holder = rows.find((invoice) => invoice.payments.some((p) => p.paymentId === paymentId));
  if (!holder) throw new Error('Payment not found');
  const name = holder.supplierName.trim().toLowerCase();
  return rows.filter((invoice) => invoice.supplierName.trim().toLowerCase() === name);
}

function checkMethod(method: unknown): void {
  if (method !== undefined && !SUPPLIER_PAYMENT_METHODS.includes(String(method))) {
    throw new Error('Payment method must be cash, card, bank or cheque');
  }
}

/** Spread a payment again with a new amount; returns the invoices whose payments change. */
function respreadPayment(invoices: Invoice[], paymentId: string, amount: number, changes: { remarks?: string; method?: string }): Plan[] {
  const existing = invoices.flatMap((invoice) => invoice.payments.filter((p) => p.paymentId === paymentId));
  if (existing.length === 0) throw new Error('Payment not found');

  const method = changes.method ?? existing[0].method;
  const template: Payment = {
    amount: 0,
    paidAt: existing[0].paidAt,
    paymentId,
    remarks: changes.remarks ?? existing[0].remarks ?? '',
    ...(method ? { method } : {}),
  };

  // The payment stays on the invoices it already covers as far as it can, and
  // only spills onto others (oldest first) when it grows past them.
  const holds = (invoice: Invoice) => invoice.payments.some((p) => p.paymentId === paymentId);
  const ordered = [...invoices.filter(holds), ...invoices.filter((invoice) => !holds(invoice))];

  let remaining = round2(amount);
  const plans: Plan[] = [];
  for (const invoice of ordered) {
    const others = invoice.payments.filter((p) => p.paymentId !== paymentId);
    const hadShare = others.length !== invoice.payments.length;
    const paidByOthers = round2(invoice.paid - invoice.payments.filter((p) => p.paymentId === paymentId).reduce((sum, p) => sum + Number(p.amount), 0));

    const room = round2(invoice.amount - paidByOthers);
    const share = remaining > ROUNDING_TOLERANCE && room > ROUNDING_TOLERANCE ? round2(Math.min(room, remaining)) : 0;
    remaining = round2(remaining - share);

    if (!hadShare && share === 0) continue;
    const payments = share > 0 ? [...others, { ...template, amount: share }] : others;
    payments.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
    plans.push({ id: invoice._id, paid: round2(paidByOthers + share), payments });
  }

  if (remaining > ROUNDING_TOLERANCE) {
    throw new Error(`At most ${round2(amount - remaining).toFixed(2)} can be paid to this supplier; a payment cannot be more than they are owed`);
  }
  return plans;
}

const latestPaidAt = (payments: Payment[]): string | null =>
  payments.length ? new Date(Math.max(...payments.map((p) => new Date(p.paidAt).getTime()))).toISOString() : null;

/** Correct an invoice's amount (never below what has been paid on it) or remarks. */
export function updateInvoice(invoiceId: string, changes: Record<string, unknown>) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new Error('Supplier invoice not found');

  const amount = changes.amount === undefined ? invoice.amount : round2(Number(changes.amount));
  if (!(amount > 0)) throw new Error('Amount must be more than zero');
  if (amount < invoice.paid - ROUNDING_TOLERANCE) {
    throw new Error(`${invoice.paid.toFixed(2)} has already been paid on invoice ${invoice.invoiceNo}; the amount cannot be less than that`);
  }
  const remarks = changes.remarks === undefined ? (invoice as any).remarks ?? '' : String(changes.remarks).trim();

  const ts = now();
  dbTransaction((d) => {
    d.run(`UPDATE supplier_invoices SET amount = $amount, remarks = $remarks, updatedAt = $ts, isSync = 0 WHERE _id = $id`, {
      $amount: amount,
      $remarks: remarks,
      $ts: ts,
      $id: invoiceId,
    });
  });
  return getInvoice(invoiceId);
}

/** Give a payment recorded before payments had ids an id, so it can be corrected like the rest. */
export function identifyPayment(invoiceId: string, index: number): string {
  const invoice = getInvoice(invoiceId);
  const entry = invoice?.payments[index];
  if (!invoice || !entry) throw new Error('Payment not found');
  if (entry.paymentId) return entry.paymentId;

  const paymentId = generateLocalId();
  const payments = invoice.payments.map((p, i) => (i === index ? { ...p, paymentId } : p));
  const ts = now();
  dbTransaction((d) => {
    d.run(`UPDATE supplier_invoices SET payments = $payments, updatedAt = $ts, isSync = 0 WHERE _id = $id`, {
      $payments: JSON.stringify(payments),
      $ts: ts,
      $id: invoiceId,
    });
  });
  return paymentId;
}

/** Correct a payment's amount, remarks or method, wherever its shares are. */
export function updatePayment(paymentId: string, changes: Record<string, unknown>) {
  checkMethod(changes.method);
  const invoices = supplierInvoicesOf(paymentId);
  const remarks = changes.remarks === undefined ? undefined : String(changes.remarks).trim();
  const method = changes.method === undefined ? undefined : String(changes.method);

  let plans: Plan[];
  if (changes.amount === undefined) {
    // Only the description changes: every share of the payment gets it.
    plans = invoices
      .filter((invoice) => invoice.payments.some((p) => p.paymentId === paymentId))
      .map((invoice) => ({
        id: invoice._id,
        paid: invoice.paid,
        payments: invoice.payments.map((p) =>
          p.paymentId === paymentId ? { ...p, ...(remarks !== undefined ? { remarks } : {}), ...(method !== undefined ? { method } : {}) } : p
        ),
      }));
  } else {
    const amount = round2(Number(changes.amount));
    if (!(amount > 0)) throw new Error('Amount must be more than zero');
    plans = respreadPayment(invoices, paymentId, amount, { remarks, method });
  }

  const ts = now();
  dbTransaction((d) => {
    for (const plan of plans) {
      d.run(
        `UPDATE supplier_invoices SET paid = $paid, payments = $payments, lastPaymentAt = $last, updatedAt = $ts, isSync = 0 WHERE _id = $id`,
        { $paid: plan.paid, $payments: JSON.stringify(plan.payments), $last: latestPaidAt(plan.payments), $ts: ts, $id: plan.id }
      );
    }
  });
  return plans.map((plan) => getInvoice(plan.id));
}

export function registerSupplierLedgerHandlers(): void {
  handleLicensed('supplierInvoices:updateInvoice', (_e, invoiceId: string, changes: Record<string, unknown>) => updateInvoice(invoiceId, changes));
  handleLicensed('supplierInvoices:updatePayment', (_e, paymentId: string, changes: Record<string, unknown>) => updatePayment(paymentId, changes));
  handleLicensed('supplierInvoices:updateLegacyPayment', (_e, invoiceId: string, index: number, changes: Record<string, unknown>) =>
    updatePayment(identifyPayment(invoiceId, Number(index)), changes)
  );
}
