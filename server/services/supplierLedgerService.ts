/**
 * Corrections to a supplier's ledger, made from the ledger statement.
 *
 * A supplier is paid as one account: each payment is spread over their oldest
 * unpaid invoices, and every invoice keeps its share under the payment's id.
 * So correcting a payment's amount takes all its shares back and spreads the
 * new amount again: over the invoices it already covered first, then the
 * oldest others, keeping its date, method and remarks. Each invoice's `paid` always equals the sum of its payments, so the
 * balances, statuses and totals follow without any separate bookkeeping.
 *
 * Writes are conditional on each invoice's `paid` being what was read; if any
 * changed meanwhile, the shares already written are put back and the caller
 * is asked to try again.
 */
import { Types } from 'mongoose';
import { BadRequestError, NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import SupplierInvoice, { ISupplierInvoice, ISupplierPayment, SUPPLIER_PAYMENT_METHODS } from '../models/SupplierInvoice';
import { sameValueFilter } from '../utils/query';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export type SupplierPaymentMethod = (typeof SUPPLIER_PAYMENT_METHODS)[number];

export interface InvoiceChanges {
  amount?: number;
  remarks?: string;
}

export interface PaymentChanges {
  amount?: number;
  remarks?: string;
  method?: SupplierPaymentMethod;
}

/** The parts of an invoice the re-spreading reads and rewrites. */
export interface InvoiceShape {
  id: string;
  amount: number;
  paid: number;
  payments: ISupplierPayment[];
}

export interface InvoicePlan {
  id: string;
  paid: number;
  payments: ISupplierPayment[];
}

/**
 * Spread a payment again with a new amount. Pure: takes the supplier's
 * invoices oldest first and returns the ones whose payments change.
 */
export function respreadPayment(invoices: InvoiceShape[], paymentId: string, amount: number, changes: Omit<PaymentChanges, 'amount'> = {}): InvoicePlan[] {
  const existing = invoices.flatMap((invoice) => invoice.payments.filter((p) => p.paymentId === paymentId));
  if (existing.length === 0) throw new NotFoundError('Payment');

  // The payment keeps its date, method and remarks unless they are being changed too.
  const template: ISupplierPayment = {
    amount: 0,
    paidAt: existing[0].paidAt,
    paymentId,
    remarks: changes.remarks ?? existing[0].remarks ?? '',
    ...((changes.method ?? existing[0].method) ? { method: changes.method ?? existing[0].method } : {}),
  };

  // The payment stays on the invoices it already covers as far as it can, and
  // only spills onto others (oldest first) when it grows past them.
  const holds = (invoice: InvoiceShape) => invoice.payments.some((p) => p.paymentId === paymentId);
  const ordered = [...invoices.filter(holds), ...invoices.filter((invoice) => !holds(invoice))];

  let remaining = round2(amount);
  const plans: InvoicePlan[] = [];

  for (const invoice of ordered) {
    const others = invoice.payments.filter((p) => p.paymentId !== paymentId);
    const hadShare = others.length !== invoice.payments.length;
    const paidByOthers = round2(invoice.paid - invoice.payments.filter((p) => p.paymentId === paymentId).reduce((sum, p) => sum + p.amount, 0));

    const room = round2(invoice.amount - paidByOthers);
    const share = remaining > ROUNDING_TOLERANCE && room > ROUNDING_TOLERANCE ? round2(Math.min(room, remaining)) : 0;
    remaining = round2(remaining - share);

    if (!hadShare && share === 0) continue;
    const payments = share > 0 ? [...others, { ...template, amount: share }] : others;
    payments.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
    plans.push({ id: invoice.id, paid: round2(paidByOthers + share), payments });
  }

  if (remaining > ROUNDING_TOLERANCE) {
    const owed = round2(amount - remaining);
    throw new BadRequestError(`At most ${owed.toFixed(2)} can be paid to this supplier; a payment cannot be more than they are owed`);
  }
  return plans;
}

const latestPaidAt = (payments: ISupplierPayment[]): Date | null =>
  payments.length ? new Date(Math.max(...payments.map((p) => new Date(p.paidAt).getTime()))) : null;

/** Write the plan, each invoice only if nobody changed it since it was read; undo on a clash. */
async function applyPlans(plans: InvoicePlan[], before: Map<string, ISupplierInvoice>): Promise<void> {
  const written: InvoicePlan[] = [];
  for (const plan of plans) {
    const original = before.get(plan.id)!;
    const updated = await SupplierInvoice.findOneAndUpdate(
      { _id: plan.id, paid: original.paid },
      { $set: { paid: plan.paid, payments: plan.payments, lastPaymentAt: latestPaidAt(plan.payments) } }
    );
    if (!updated) {
      await Promise.all(
        written.map((done) => {
          const restore = before.get(done.id)!;
          return SupplierInvoice.updateOne(
            { _id: done.id, paid: done.paid },
            { $set: { paid: restore.paid, payments: restore.payments, lastPaymentAt: restore.lastPaymentAt ?? null } }
          ).catch((error) => logger.error({ err: error, invoiceId: done.id }, 'Failed to undo a supplier payment correction'));
        })
      );
      throw new BadRequestError("This supplier's invoices changed while saving; please try again");
    }
    written.push(plan);
  }
}

/** Correct an invoice's amount (never below what has been paid on it) or remarks. */
export async function updateInvoice(invoiceId: string, changes: InvoiceChanges): Promise<ISupplierInvoice> {
  const invoice = await SupplierInvoice.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Supplier invoice');

  const set: Record<string, unknown> = {};
  if (changes.amount !== undefined) {
    const amount = round2(changes.amount);
    if (amount < invoice.paid - ROUNDING_TOLERANCE) {
      throw new BadRequestError(`${invoice.paid.toFixed(2)} has already been paid on invoice ${invoice.invoiceNo}; the amount cannot be less than that`);
    }
    set.amount = amount;
  }
  if (changes.remarks !== undefined) set.remarks = changes.remarks;

  // Conditional on `paid`, so a payment landing meanwhile cannot leave the invoice overpaid.
  const updated = await SupplierInvoice.findOneAndUpdate(
    { _id: invoiceId, paid: invoice.paid },
    { $set: set },
    { returnDocument: 'after', runValidators: true }
  );
  if (!updated) throw new BadRequestError('This invoice changed while saving; please try again');
  return updated;
}

/**
 * Give a payment recorded before payments had ids (one entry on one invoice)
 * an id, so it can be corrected like any other payment.
 */
export async function identifyPayment(invoiceId: string, index: number): Promise<string> {
  const invoice = await SupplierInvoice.findById(invoiceId);
  const entry = invoice?.payments[index];
  if (!invoice || !entry) throw new NotFoundError('Payment');
  if (entry.paymentId) return entry.paymentId;

  const paymentId = new Types.ObjectId().toString();
  await SupplierInvoice.updateOne({ _id: invoiceId }, { $set: { [`payments.${index}.paymentId`]: paymentId } });
  return paymentId;
}

/** Correct a payment's amount, remarks or method, wherever its shares are. */
export async function updatePayment(paymentId: string, changes: PaymentChanges): Promise<ISupplierInvoice[]> {
  const holders = await SupplierInvoice.find({ 'payments.paymentId': paymentId });
  if (holders.length === 0) throw new NotFoundError('Payment');

  if (changes.amount === undefined) {
    // Only the description changes: every share of the payment gets it.
    const set: Record<string, unknown> = {};
    if (changes.remarks !== undefined) set['payments.$[share].remarks'] = changes.remarks;
    if (changes.method !== undefined) set['payments.$[share].method'] = changes.method;
    await SupplierInvoice.updateMany({ 'payments.paymentId': paymentId }, { $set: set }, { arrayFilters: [{ 'share.paymentId': paymentId }] });
    return SupplierInvoice.find({ 'payments.paymentId': paymentId });
  }

  const invoices = await SupplierInvoice.find(sameValueFilter('supplierName', holders[0].supplierName)).sort({ date: 1, createdAt: 1 });
  const plans = respreadPayment(
    invoices.map((invoice) => ({ id: String(invoice._id), amount: invoice.amount, paid: invoice.paid, payments: invoice.payments.map((p) => (typeof (p as any).toObject === 'function' ? (p as any).toObject() : p)) })),
    paymentId,
    changes.amount,
    { remarks: changes.remarks, method: changes.method }
  );
  await applyPlans(plans, new Map(invoices.map((invoice) => [String(invoice._id), invoice.toObject() as ISupplierInvoice])));
  return SupplierInvoice.find({ _id: { $in: plans.map((plan) => plan.id) } });
}
