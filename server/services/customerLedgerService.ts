/**
 * Corrections to a customer's account, made from the account statement.
 *
 * A customer's outstanding balance is the opening balance, plus what sales put
 * on account, minus payments. Each correction here changes one of those
 * figures and moves the outstanding balance by exactly the difference, so the
 * statement, the balance, the receipts and the KPIs always agree.
 *
 * The balance moves first, through a conditional update that refuses to take
 * it below zero; the edited record follows, and the balance is put back if
 * that write fails.
 */
import { BadRequestError, NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import Customer, { ICustomer } from '../models/Customer';
import CustomerPayment, { ICustomerPayment } from '../models/CustomerPayment';
import Order, { IOrder } from '../models/Order';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const round2 = (value: number): number => Math.round(value * 100) / 100;

export interface PaymentChanges {
  amountPaid?: number;
  paymentMethod?: 'cash' | 'card';
  notes?: string;
}

export interface SaleChanges {
  /** How much of the sale goes on the customer's account. */
  creditAmount?: number;
  remarks?: string;
}

/** How a sale was settled: these always add up to its total. */
export interface Settlement {
  paidCash: number;
  paidCard: number;
  creditAmount: number;
}

/** Move a customer's balance by `delta`, refusing to take it below zero. */
async function moveBalance(customerId: string, delta: number): Promise<ICustomer> {
  const customer = await Customer.findOneAndUpdate(
    {
      _id: customerId,
      $expr: { $gte: [{ $add: [{ $ifNull: ['$outstandingBalance', 0] }, delta] }, -ROUNDING_TOLERANCE] },
    },
    { $inc: { outstandingBalance: delta } },
    { returnDocument: 'after' }
  );
  if (customer) return customer;

  const existing = await Customer.findById(customerId).select('name outstandingBalance');
  if (!existing) throw new NotFoundError('Customer');
  throw new BadRequestError(
    `That change would leave ${existing.name} with a negative balance (they owe ${round2(existing.outstandingBalance ?? 0).toFixed(2)})`
  );
}

/** Run `write` after moving the balance; if it fails, put the balance back. */
async function withBalanceMove<T>(customerId: string, delta: number, write: () => Promise<T>): Promise<{ customer: ICustomer; result: T }> {
  const customer = await moveBalance(customerId, delta);
  try {
    return { customer, result: await write() };
  } catch (error) {
    if (delta !== 0) {
      await Customer.updateOne({ _id: customerId }, { $inc: { outstandingBalance: -delta } });
      logger.warn({ err: error, customerId }, 'Undid a balance change after the ledger edit failed');
    }
    throw error;
  }
}

/**
 * How a sale stands now. Older sales only recorded the payment method, so
 * their split is worked out from it.
 */
export function currentSettlement(order: Pick<IOrder, 'total' | 'paymentMethod' | 'paidCash' | 'paidCard' | 'creditAmount' | 'splitCash' | 'splitCard'>): Settlement {
  const total = round2(order.total);
  const recorded = {
    paidCash: round2(order.paidCash ?? 0),
    paidCard: round2(order.paidCard ?? 0),
    creditAmount: round2(order.creditAmount ?? 0),
  };
  if (Math.abs(recorded.paidCash + recorded.paidCard + recorded.creditAmount - total) <= ROUNDING_TOLERANCE) return recorded;

  const method = (order.paymentMethod ?? '').toLowerCase();
  if (method === 'card') return { paidCash: 0, paidCard: total, creditAmount: 0 };
  if (method === 'credit') return { paidCash: 0, paidCard: 0, creditAmount: total };
  if (method.startsWith('split')) {
    const paidCash = round2(order.splitCash ?? 0);
    const paidCard = round2(order.splitCard ?? 0);
    return { paidCash, paidCard, creditAmount: round2(Math.max(0, total - paidCash - paidCard)) };
  }
  return { paidCash: total, paidCard: 0, creditAmount: 0 };
}

/**
 * The sale settled again with a different amount on account. What is paid at
 * the till changes by the difference: cash first, so a card payment already
 * taken stays as it was unless there is no cash left to adjust.
 */
export function resettle(order: Parameters<typeof currentSettlement>[0], creditAmount: number): Settlement & { paymentMethod: string } {
  const total = round2(order.total);
  const now = currentSettlement(order);
  const atTill = round2(total - creditAmount);
  const paidCard = round2(Math.min(now.paidCard, atTill));
  const paidCash = round2(atTill - paidCard);

  const paymentMethod = creditAmount > ROUNDING_TOLERANCE ? 'credit' : paidCard <= ROUNDING_TOLERANCE ? 'cash' : paidCash <= ROUNDING_TOLERANCE ? 'card' : 'split';
  return { paidCash, paidCard, creditAmount: round2(creditAmount), paymentMethod };
}

/** Correct a payment's amount, method or notes. */
export async function updatePayment(customerId: string, paymentId: string, changes: PaymentChanges) {
  const payment = await CustomerPayment.findOne({ _id: paymentId, customerId });
  if (!payment) throw new NotFoundError('Payment');

  const amountPaid = changes.amountPaid === undefined ? payment.amountPaid : round2(changes.amountPaid);
  // A larger payment lowers what the customer owes, a smaller one raises it.
  const delta = round2(payment.amountPaid - amountPaid);

  const { customer, result } = await withBalanceMove(customerId, delta, async () => {
    payment.amountPaid = amountPaid;
    if (changes.paymentMethod !== undefined) payment.paymentMethod = changes.paymentMethod;
    if (changes.notes !== undefined) payment.notes = changes.notes;
    return payment.save();
  });
  return { customer, payment: result as ICustomerPayment };
}

/** Correct how much of a sale went on account, or its remarks. */
export async function updateSale(customerId: string, orderId: string, changes: SaleChanges) {
  const order = await Order.findOne({ _id: orderId, customerId, status: { $ne: 'voided' } });
  if (!order) throw new NotFoundError('Sale');

  const now = currentSettlement(order);
  const creditAmount = changes.creditAmount === undefined ? now.creditAmount : round2(changes.creditAmount);
  if (creditAmount > round2(order.total) + ROUNDING_TOLERANCE) {
    throw new BadRequestError(`At most the sale total (${round2(order.total).toFixed(2)}) can go on account`);
  }
  const delta = round2(creditAmount - now.creditAmount);

  const { customer, result } = await withBalanceMove(customerId, delta, async () => {
    if (delta !== 0) {
      const settled = resettle(order, creditAmount);
      order.paidCash = settled.paidCash;
      order.paidCard = settled.paidCard;
      order.creditAmount = settled.creditAmount;
      order.paymentMethod = settled.paymentMethod;
      if (settled.paymentMethod === 'split') {
        order.splitCash = settled.paidCash;
        order.splitCard = settled.paidCard;
      }
      // The receipt shows the account after this sale; later receipts keep the balance they printed.
      if (order.balanceBefore !== null && order.balanceBefore !== undefined) {
        order.balanceAfter = round2(order.balanceBefore + settled.creditAmount);
      }
    }
    if (changes.remarks !== undefined) order.remarks = changes.remarks || null;
    return order.save();
  });
  return { customer, order: result as IOrder };
}

/** Delete a recorded payment: the customer owes that amount again. */
export async function deletePayment(customerId: string, paymentId: string): Promise<ICustomer> {
  const payment = await CustomerPayment.findOne({ _id: paymentId, customerId });
  if (!payment) throw new NotFoundError('Payment');

  const { customer } = await withBalanceMove(customerId, round2(payment.amountPaid), () => payment.deleteOne());
  return customer;
}

/** Change a customer's opening balance; what they owe moves by the same amount. */
export async function setOpeningBalance(customerId: string, openingBalance: number): Promise<ICustomer> {
  const existing = await Customer.findById(customerId).select('openingBalance');
  if (!existing) throw new NotFoundError('Customer');

  const value = round2(openingBalance);
  const delta = round2(value - (existing.openingBalance ?? 0));
  const { result } = await withBalanceMove(customerId, delta, () =>
    Customer.findByIdAndUpdate(customerId, { $set: { openingBalance: value } }, { returnDocument: 'after' })
  );
  return result as ICustomer;
}
