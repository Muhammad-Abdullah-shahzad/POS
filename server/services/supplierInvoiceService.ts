/**
 * Paying supplier invoices.
 *
 * A payment is added with a conditional update, so two payments made at the
 * same time can never take an invoice past its amount.
 */
import { Types } from 'mongoose';
import { BadRequestError, NotFoundError } from '../core/errors';
import SupplierInvoice, { ISupplierInvoice, SUPPLIER_PAYMENT_METHODS } from '../models/SupplierInvoice';
import { sameValueFilter } from '../utils/query';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

export async function recordSupplierPayment(
  invoiceId: string,
  amount: number,
  remarks = ''
): Promise<ISupplierInvoice> {
  const paidAt = new Date();
  const paymentId = new Types.ObjectId().toString();
  const invoice = await SupplierInvoice.findOneAndUpdate(
    { _id: invoiceId, $expr: { $lte: [{ $add: ['$paid', amount] }, { $add: ['$amount', ROUNDING_TOLERANCE] }] } },
    { $inc: { paid: amount }, $set: { lastPaymentAt: paidAt }, $push: { payments: { amount, remarks, paidAt, paymentId, method: 'cash' } } },
    { returnDocument: 'after' }
  );
  if (invoice) return invoice;

  const existing = await SupplierInvoice.findById(invoiceId).select('amount paid');
  if (!existing) throw new NotFoundError('Supplier invoice');

  const balance = Math.max(0, existing.amount - existing.paid);
  throw new BadRequestError(`The balance on this invoice is ${balance.toFixed(2)}; a payment cannot be more than that`);
}

export interface SupplierPaymentOutcome {
  paymentId: string;
  amount: number;
  /** How the payment was split, oldest invoice first. */
  applied: { invoiceId: string; invoiceNo: string; amount: number }[];
}

/**
 * Pay a supplier rather than one invoice: the money clears their oldest unpaid
 * invoices first. Each invoice records its share under one payment id, so the
 * ledger can show the payment as a single line.
 */
export async function paySupplier(
  supplierName: string,
  amount: number,
  remarks = '',
  method: (typeof SUPPLIER_PAYMENT_METHODS)[number] = 'cash'
): Promise<SupplierPaymentOutcome> {
  const open = await SupplierInvoice.find({
    ...sameValueFilter('supplierName', supplierName),
    $expr: { $gt: ['$amount', { $add: ['$paid', ROUNDING_TOLERANCE] }] },
  }).sort({ date: 1, createdAt: 1 });

  const owed = round2(open.reduce((sum, invoice) => sum + invoice.amount - invoice.paid, 0));
  if (open.length === 0) throw new BadRequestError(`Nothing is owed to ${supplierName}`);
  if (amount > owed + ROUNDING_TOLERANCE) {
    throw new BadRequestError(`${supplierName} is owed ${owed.toFixed(2)}; a payment cannot be more than that`);
  }

  const paymentId = new Types.ObjectId().toString();
  const paidAt = new Date();
  const applied: SupplierPaymentOutcome['applied'] = [];
  let remaining = round2(amount);

  for (const invoice of open) {
    if (remaining <= ROUNDING_TOLERANCE) break;
    const share = round2(Math.min(remaining, invoice.amount - invoice.paid));

    const updated = await SupplierInvoice.findOneAndUpdate(
      { _id: invoice._id, $expr: { $lte: [{ $add: ['$paid', share] }, { $add: ['$amount', ROUNDING_TOLERANCE] }] } },
      {
        $inc: { paid: share },
        $set: { lastPaymentAt: paidAt },
        $push: { payments: { amount: share, remarks, paidAt, paymentId, method } },
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      // Someone else paid this invoice meanwhile: undo the shares already taken.
      await Promise.all(
        applied.map((part) =>
          SupplierInvoice.updateOne(
            { _id: part.invoiceId },
            { $inc: { paid: -part.amount }, $pull: { payments: { paymentId } } }
          )
        )
      );
      throw new BadRequestError(`${supplierName}'s balance changed while paying; please try again`);
    }

    applied.push({ invoiceId: String(invoice._id), invoiceNo: invoice.invoiceNo, amount: share });
    remaining = round2(remaining - share);
  }

  return { paymentId, amount: round2(amount), applied };
}
