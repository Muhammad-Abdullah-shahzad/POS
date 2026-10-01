/**
 * Product returns.
 *
 * Invoice returns refund each item at what was actually paid for it on the
 * original sale (its line total over its quantity, discounts and deposits
 * included), and never more of a line than was sold less what came back
 * before. Open returns take the cashier's price and discount.
 *
 * Every returned item goes back into stock. A refund to the customer's
 * account takes the amount off what they owe; anything beyond what they owe
 * is paid out in cash. If saving the return fails, the stock and balance
 * changes are undone.
 */
import { Types } from 'mongoose';
import { BadRequestError, NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import Customer from '../models/Customer';
import { nextSequence } from '../models/Counter';
import Order, { IOrder } from '../models/Order';
import Product from '../models/Product';
import ProductReturn, { IProductReturn, IReturnItem, REFUND_METHODS } from '../models/ProductReturn';

const RETURN_SEQUENCE = 'return';

/** Allows for rounding in amounts with pennies, e.g. 0.1 + 0.2. */
const ROUNDING_TOLERANCE = 0.005;

const round2 = (value: number): number => Math.round(value * 100) / 100;

type RefundMethod = (typeof REFUND_METHODS)[number];

export interface InvoiceReturnInput {
  type: 'invoice';
  orderId: string;
  items: { orderLine: number; quantity: number }[];
  refundMethod: RefundMethod;
  reason?: string;
}

export interface OpenReturnInput {
  type: 'open';
  items: { product: string; quantity: number; unitPrice: number; discountPct?: number }[];
  refundMethod: Exclude<RefundMethod, 'account'>;
  reason?: string;
}

export type ReturnInput = InvoiceReturnInput | OpenReturnInput;

/** What can still come back from one line of a sale, and what each unit is refunded at. */
export interface ReturnableLine {
  orderLine: number;
  product: string | null;
  name: string;
  sold: number;
  returned: number;
  /** Refunded per unit: the line's total over its quantity. */
  unitPrice: number;
  /** The line's total charged, so a full return refunds exactly that. */
  lineTotal: number;
  /** Already refunded for this line by earlier returns. */
  refunded: number;
}

/** Each line of a sale with what was paid and how much of it has already come back. */
export function returnableLines(order: Pick<IOrder, 'items'>, earlier: Pick<IProductReturn, 'items'>[]): ReturnableLine[] {
  return order.items.map((item, orderLine) => {
    const sold = Number(item.quantity) || 0;
    const lineTotal = round2(
      Number.isFinite(Number(item.finalPrice)) ? Number(item.finalPrice) : sold * ((Number(item.price) || 0) + (Number(item.drs) || 0))
    );
    const previous = earlier.flatMap((ret) => ret.items.filter((line) => line.orderLine === orderLine));
    return {
      orderLine,
      product: item.product ? String(item.product) : null,
      name: item.name,
      sold,
      returned: previous.reduce((sum, line) => sum + line.quantity, 0),
      unitPrice: sold > 0 ? round2(lineTotal / sold) : 0,
      lineTotal,
      refunded: round2(previous.reduce((sum, line) => sum + line.total, 0)),
    };
  });
}

/** The items of an invoice return, checked against what is still returnable. */
function invoiceItems(lines: ReturnableLine[], requested: InvoiceReturnInput['items']): IReturnItem[] {
  const seen = new Set<number>();
  return requested.map(({ orderLine, quantity }) => {
    const line = lines[orderLine];
    if (!line) throw new BadRequestError('That item is not on this sale');
    if (seen.has(orderLine)) throw new BadRequestError(`${line.name} is listed twice`);
    seen.add(orderLine);

    const left = line.sold - line.returned;
    if (quantity > left + 1e-9) {
      throw new BadRequestError(`Only ${left} of ${line.name} can still be returned (${line.sold} sold, ${line.returned} already returned)`);
    }
    // Returning the last of a line refunds exactly what is left of its total, so pennies never drift.
    const total = Math.abs(quantity - left) < 1e-9 ? round2(line.lineTotal - line.refunded) : round2(line.unitPrice * quantity);
    return { product: line.product, name: line.name, quantity, unitPrice: line.unitPrice, total, orderLine };
  });
}

/** The items of an open return, priced as the cashier entered them. */
async function openItems(requested: OpenReturnInput['items']): Promise<IReturnItem[]> {
  const products = await Product.find({ _id: { $in: requested.map((item) => item.product) } }).select('name');
  const names = new Map(products.map((product) => [String(product._id), product.name]));

  return requested.map((item) => {
    const name = names.get(String(item.product));
    if (!name) throw new NotFoundError('Product');
    const discountPct = item.discountPct ?? 0;
    const unitPrice = round2(item.unitPrice * (1 - discountPct / 100));
    return { product: String(item.product), name, quantity: item.quantity, unitPrice, discountPct, total: round2(unitPrice * item.quantity) };
  });
}

async function moveStock(items: IReturnItem[], direction: 1 | -1): Promise<void> {
  await Promise.all(
    items
      .filter((item) => item.product && Types.ObjectId.isValid(String(item.product)))
      .map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: direction * item.quantity } }))
  );
}

/**
 * Take up to `amount` off what the customer owes, never below zero.
 * Returns how much was taken.
 */
async function creditAccount(customerId: string, amount: number): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const customer = await Customer.findById(customerId).select('outstandingBalance');
    if (!customer) throw new NotFoundError('Customer');
    const owed = round2(Math.max(0, customer.outstandingBalance ?? 0));
    const taken = round2(Math.min(amount, owed));
    if (taken <= 0) return 0;

    const updated = await Customer.updateOne(
      { _id: customerId, outstandingBalance: customer.outstandingBalance },
      { $inc: { outstandingBalance: -taken } }
    );
    if (updated.modifiedCount === 1) return taken;
  }
  throw new BadRequestError("The customer's balance changed while saving; please try again");
}

export async function createReturn(input: ReturnInput): Promise<IProductReturn> {
  let items: IReturnItem[];
  let sale: IOrder | null = null;

  if (input.type === 'invoice') {
    sale = await Order.findById(input.orderId);
    if (!sale) throw new NotFoundError('Sale');
    if (sale.status === 'voided') throw new BadRequestError('This sale was voided, so nothing on it can be returned');
    const earlier = await ProductReturn.find({ orderId: String(sale._id) }).select('items');
    items = invoiceItems(returnableLines(sale, earlier), input.items);
  } else {
    items = await openItems(input.items);
  }

  const total = round2(items.reduce((sum, item) => sum + item.total, 0));
  if (total < 0) throw new BadRequestError('A refund cannot be negative');
  const customerId = sale?.customerId ? String(sale.customerId) : null;
  if (input.refundMethod === 'account' && !customerId) {
    throw new BadRequestError('Only a sale to a customer can be refunded to their account');
  }

  await moveStock(items, 1);
  let refundToAccount = 0;
  let saved: IProductReturn;
  try {
    if (input.refundMethod === 'account' && customerId) refundToAccount = await creditAccount(customerId, total);
    const rest = round2(total - refundToAccount);

    saved = await ProductReturn.create({
      returnNo: `RET-${await nextSequence(RETURN_SEQUENCE)}`,
      type: input.type,
      orderId: sale ? String(sale._id) : null,
      invoiceId: sale?.invoiceId ?? null,
      customerId,
      customerName: sale?.customerName ?? null,
      items,
      total,
      refundMethod: input.refundMethod,
      refundToAccount,
      // What did not go to the account is paid out the way chosen; an account refund pays the rest in cash.
      refundCash: input.refundMethod === 'card' ? 0 : rest,
      refundCard: input.refundMethod === 'card' ? rest : 0,
      reason: input.reason ?? '',
    });
  } catch (error) {
    await moveStock(items, -1).catch((undo) => logger.error({ err: undo }, 'Failed to take returned stock back out'));
    if (refundToAccount > 0 && customerId) {
      await Customer.updateOne({ _id: customerId }, { $inc: { outstandingBalance: refundToAccount } }).catch((undo) =>
        logger.error({ err: undo, customerId }, 'Failed to restore a balance after a failed return')
      );
    }
    throw error;
  }

  // Once the return is saved nothing above is undone. What the customer spent
  // with the shop goes down by what they got back, never below zero.
  if (customerId && total > 0) {
    try {
      await Customer.updateOne(
        { _id: customerId },
        [{ $set: { totalAmount: { $max: [0, { $subtract: [{ $ifNull: ['$totalAmount', 0] }, total] }] } } }],
        { updatePipeline: true }
      );
    } catch (error) {
      logger.error({ err: error, customerId }, "Failed to lower a customer's total spent after a return");
    }
  }
  return saved;
}
