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
import { nextSequence } from '../models/Counter';
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

export async function createOrder(input: CreateOrderInput): Promise<IOrder> {
  const items = input.items.map(toOrderItem);
  const deducted = new Map<string, number>();

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
      customerId: input.customerId ?? null,
      customerName: input.customerName ?? null,
    });
  } catch (error) {
    if (deducted.size > 0) await releaseStock(deducted);
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

  return order;
}
