/**
 * Order checkout and voiding.
 *
 * Stock is the part that has to be exact: two tills may ring up the last unit
 * at the same moment. Each deduction is a conditional update that only applies
 * when enough stock is on hand, and anything already deducted is returned if a
 * later line fails.
 */
import { Types } from 'mongoose';
import { BadRequestError, NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import Order, { IOrder, IOrderItem } from '../models/Order';
import Product from '../models/Product';
import Customer from '../models/Customer';
import { nextSequence } from '../models/Counter';
import { currentSettlement } from './customerLedgerService';
import type { CreateOrderInput, OrderItemInput } from '../validators/orderValidators';

const RECEIPT_SEQUENCE = 'receipt';

/** Normalise a submitted line into the shape stored on the order. */
function toOrderItem(item: OrderItemInput): IOrderItem {
  const productId = item.product ?? item.productId;

  return {
    ...(productId && { product: new Types.ObjectId(productId) }),
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    vatRate: item.vatRate,
    vatAmount: item.vatAmount,
    totalPrice: item.totalPrice,
    discountPct: item.discountPct,
    discountAmt: item.discountAmt,
    finalPrice: item.finalPrice ?? item.totalPrice,
    drs: item.drs,
  };
}

/** One line per product, with quantities of repeated products added together. */
function stockMovements(items: IOrderItem[]): Map<string, { quantity: number; name: string }> {
  const totals = new Map<string, { quantity: number; name: string }>();

  for (const item of items) {
    if (!item.product) continue;

    const key = item.product.toString();
    const existing = totals.get(key);
    totals.set(key, {
      quantity: (existing?.quantity ?? 0) + item.quantity,
      name: existing?.name ?? item.name,
    });
  }

  return totals;
}

async function releaseStock(movements: Map<string, number>): Promise<void> {
  await Promise.all(
    [...movements].map(([productId, quantity]) =>
      Product.findByIdAndUpdate(productId, { $inc: { stock: quantity } }).catch((error) =>
        logger.error({ err: error, productId }, 'Failed to return stock after a failed checkout')
      )
    )
  );
}

/**
 * How a sale was settled, worked out here rather than taken from the till, so
 * the books cannot disagree with the receipt. Whatever is not handed over at
 * the till goes on the customer's account.
 *
 *   cash, card   the whole total, one way
 *   split        the cash and card parts; any shortfall goes on account
 *   credit       optional cash and card deposits; the rest goes on account
 */
function settlement(input: CreateOrderInput): { paidCash: number; paidCard: number; creditAmount: number } {
  const method = (input.paymentMethod ?? '').toLowerCase();
  const total = input.total;

  if (method === 'cash' || method === 'card') {
    return { paidCash: method === 'cash' ? total : 0, paidCard: method === 'card' ? total : 0, creditAmount: 0 };
  }

  const partPayment =
    method === 'credit'
      ? { cash: input.paidCash ?? 0, card: input.paidCard ?? 0 }
      : method.startsWith('split')
        ? { cash: input.splitCash ?? 0, card: input.splitCard ?? 0 }
        : null;

  // Anything else is treated as cash, as the till always has.
  if (!partPayment) return { paidCash: total, paidCard: 0, creditAmount: 0 };

  if (round2(partPayment.cash + partPayment.card) > round2(total)) {
    throw new BadRequestError('The cash and card deposits add up to more than the total');
  }

  const paidCash = round2(Math.max(0, partPayment.cash));
  const paidCard = round2(Math.max(0, partPayment.card));
  return { paidCash, paidCard, creditAmount: round2(total - paidCash - paidCard) };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Move the customer's account on by what went on credit, and report where it
 * stood before and after so the invoice can show both.
 */
async function applyToAccount(
  customerId: string | null | undefined,
  creditAmount: number
): Promise<{ balanceBefore: number | null; balanceAfter: number | null; phone: string | null; address: string | null }> {
  if (!customerId) return { balanceBefore: null, balanceAfter: null, phone: null, address: null };

  const customer =
    creditAmount > 0
      ? await Customer.findByIdAndUpdate(customerId, { $inc: { outstandingBalance: creditAmount } }, { returnDocument: 'after' })
      : await Customer.findById(customerId);

  if (!customer) return { balanceBefore: null, balanceAfter: null, phone: null, address: null };

  const balanceAfter = round2(customer.outstandingBalance ?? 0);
  return {
    balanceBefore: round2(balanceAfter - creditAmount),
    balanceAfter,
    phone: customer.contactNum1 ?? null,
    address: customer.address ?? null,
  };
}

export async function createOrder(input: CreateOrderInput): Promise<IOrder> {
  // Checked before any stock moves or a receipt number is used, so a rejected
  // sale leaves nothing behind.
  const { paidCash, paidCard, creditAmount } = settlement(input);
  if (creditAmount > 0 && !input.customerId) {
    throw new BadRequestError('Choose a customer to put part of this sale on their account');
  }

  const items = input.items.map(toOrderItem);
  const deducted = new Map<string, number>();
  let chargedToAccount = false;

  try {
    for (const [productId, movement] of stockMovements(items)) {
      const updated = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: movement.quantity } },
        { $inc: { stock: -movement.quantity } },
        { returnDocument: 'after' }
      );

      if (!updated) {
        const product = await Product.findById(productId).select('name stock');
        throw new BadRequestError(
          `Not enough stock for ${product?.name ?? movement.name}. Available: ${product?.stock ?? 0}`
        );
      }

      deducted.set(productId, movement.quantity);
    }

    // Receipt numbers come from an atomic per-company counter, so they stay
    // sequential per shop without scanning the orders collection.
    const receiptNumber = await nextSequence(RECEIPT_SEQUENCE);

    const account = await applyToAccount(input.customerId, creditAmount);
    chargedToAccount = creditAmount > 0 && account.balanceAfter !== null;

    return await Order.create({
      invoiceId: String(receiptNumber),
      items,
      subtotal: input.subtotal,
      totalVAT: input.totalVAT,
      discount: input.discount,
      totalDRS: input.totalDRS,
      total: input.total,
      paymentMethod: input.paymentMethod,
      splitCash: input.splitCash ?? null,
      splitCard: input.splitCard ?? null,
      paidCash,
      paidCard,
      creditAmount,
      balanceBefore: account.balanceBefore,
      balanceAfter: account.balanceAfter,
      customerId: input.customerId ?? null,
      customerName: input.customerName ?? null,
      customerPhone: account.phone,
      customerAddress: account.address,
      remarks: input.remarks || null,
    });
  } catch (error) {
    if (deducted.size > 0) await releaseStock(deducted);
    // A sale that was not saved must not leave the customer owing for it.
    if (chargedToAccount && input.customerId) {
      await Customer.updateOne({ _id: input.customerId }, { $inc: { outstandingBalance: -creditAmount } }).catch((restoreError) =>
        logger.error({ err: restoreError, customerId: input.customerId }, 'Failed to take a failed sale off the customer account')
      );
    }
    throw error;
  }
}

export interface VoidOrderInput {
  reason: string;
  voidedByUserId?: string;
  employeeId?: string;
  employeeName?: string;
}

/** Void a completed order and put its stock back. */
export async function voidOrder(orderId: string, input: VoidOrderInput): Promise<IOrder> {
  // The status condition makes this safe to call twice: the second call finds
  // nothing to update rather than returning the stock again.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'completed' },
    {
      $set: {
        status: 'voided',
        voidReason: input.reason,
        voidedAt: new Date(),
        ...(input.voidedByUserId && { voidedBy: new Types.ObjectId(input.voidedByUserId) }),
        ...(input.employeeId && { voidedByEmployee: new Types.ObjectId(input.employeeId) }),
        ...(input.employeeName && { voidedByEmployeeName: input.employeeName }),
      },
    },
    { returnDocument: 'after' }
  );

  if (!order) {
    const existing = await Order.findById(orderId).select('status');
    if (!existing) throw new NotFoundError('Order');
    throw new BadRequestError('This order is already voided');
  }

  const movements = new Map([...stockMovements(order.items)].map(([id, m]) => [id, m.quantity]));
  await releaseStock(movements);

  // What the sale put on the customer's account comes off again. The balance
  // may go below zero: the customer had already paid for a sale that is gone.
  const credit = currentSettlement(order).creditAmount;
  if (order.customerId && credit > 0) {
    await Customer.updateOne({ _id: order.customerId }, { $inc: { outstandingBalance: -credit } }).catch((error) =>
      logger.error({ err: error, orderId }, 'Failed to take a voided sale off the customer account')
    );
  }

  return order;
}
