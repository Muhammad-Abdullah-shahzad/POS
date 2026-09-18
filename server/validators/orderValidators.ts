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
  customerId: objectId.nullish(),
  customerName: z.string().trim().max(160).nullish(),
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
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
