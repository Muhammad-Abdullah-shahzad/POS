/**
 * Paying supplier invoices.
 *
 * A payment is added with a conditional update, so two payments made at the
 * same time can never take an invoice past its amount.
 */
import { BadRequestError, NotFoundError } from '../core/errors';
import SupplierInvoice, { ISupplierInvoice } from '../models/SupplierInvoice';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

export async function recordSupplierPayment(invoiceId: string, amount: number): Promise<ISupplierInvoice> {
  const invoice = await SupplierInvoice.findOneAndUpdate(
    { _id: invoiceId, $expr: { $lte: [{ $add: ['$paid', amount] }, { $add: ['$amount', ROUNDING_TOLERANCE] }] } },
    { $inc: { paid: amount }, $set: { lastPaymentAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (invoice) return invoice;

  const existing = await SupplierInvoice.findById(invoiceId).select('amount paid');
  if (!existing) throw new NotFoundError('Supplier invoice');

  const balance = Math.max(0, existing.amount - existing.paid);
  throw new BadRequestError(`The balance on this invoice is ${balance.toFixed(2)}; a payment cannot be more than that`);
}
