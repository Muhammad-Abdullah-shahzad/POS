import { z } from 'zod';
import { objectId } from './common';

const orderItemSchema = z.object({
  product: objectId.optional(),
  productId: objectId.optional(),
  name: z.string().trim().min(1, 'Item name is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  price: z.coerce.number(),
  vatRate: z.coerce.number().default(0),
  vatAmount: z.coerce.number().default(0),
  totalPrice: z.coerce.number(),
  discountPct: z.coerce.number().default(0),
  discountAmt: z.coerce.number().default(0),
  finalPrice: z.coerce.number().optional(),
  drs: z.coerce.number().default(0),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'An order needs at least one item'),
  subtotal: z.coerce.number(),
  totalVAT: z.coerce.number(),
  discount: z.coerce.number().default(0),
  totalDRS: z.coerce.number().default(0),
  total: z.coerce.number(),
  paymentMethod: z.string().trim().min(1, 'Payment method is required'),
  splitCash: z.coerce.number().nullish(),
  splitCard: z.coerce.number().nullish(),
  /** On a credit sale: what was handed over now. The rest goes on the account. */
  paidCash: z.coerce.number().min(0, 'Cash deposit cannot be negative').nullish(),
  paidCard: z.coerce.number().min(0, 'Card deposit cannot be negative').nullish(),
  customerId: objectId.nullish(),
  customerName: z.string().trim().max(160).nullish(),
  /** Printed on the invoice under the customer details. */
  remarks: z.string().trim().max(500, 'Remarks must be 500 characters or fewer').nullish(),
});

export const voidOrderSchema = z.object({
  reason: z.string().trim().min(1).max(300).default('No reason provided'),
  employeeId: objectId.optional(),
  employeeName: z.string().trim().max(160).optional(),
});

export const orderListQuery = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2999).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  /** Part of a receipt ID. Searches every receipt, whatever month is picked. */
  search: z.string().trim().max(80).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ── Product returns ─────────────────────────────────────────────────────────
const quantity = z.coerce.number({ message: 'Quantity must be a number' }).positive('Quantity must be more than zero');

/** A return against a recorded sale: which lines come back, and how many of each. */
const invoiceReturnSchema = z.object({
  type: z.literal('invoice'),
  orderId: objectId,
  items: z.array(z.object({ orderLine: z.coerce.number().int().min(0), quantity })).min(1, 'Choose at least one item to return'),
  refundMethod: z.enum(['cash', 'card', 'account']),
  reason: z.string().trim().max(500).optional(),
});

/** A return without a sale: the products, quantities and the price refunded for each. */
const openReturnSchema = z.object({
  type: z.literal('open'),
  items: z
    .array(
      z.object({
        product: objectId,
        quantity,
        unitPrice: z.coerce.number({ message: 'Price must be a number' }).min(0, 'Price cannot be negative'),
        discountPct: z.coerce.number().min(0).max(100).default(0),
      })
    )
    .min(1, 'Add at least one product to return'),
  refundMethod: z.enum(['cash', 'card']),
  reason: z.string().trim().max(500).optional(),
});

export const createReturnSchema = z.discriminatedUnion('type', [invoiceReturnSchema, openReturnSchema]);

export const returnListQuery = z.object({
  orderId: objectId.optional(),
  customerId: objectId.optional(),
  /** Part of a return or receipt number. */
  search: z.string().trim().max(80).optional(),
});
