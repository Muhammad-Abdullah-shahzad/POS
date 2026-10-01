/**
 * A product return: goods brought back to the shop and the money refunded.
 *
 *   invoice  against a recorded sale, found by its receipt number or through
 *            the customer; items are refunded at what was paid for them
 *   open     no sale and no customer; the cashier picks the products and may
 *            change the price or give a discount
 *
 * Every returned item goes back into stock. A refund to a customer's account
 * takes the amount off what they owe.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export const RETURN_TYPES = ['invoice', 'open'] as const;
export const REFUND_METHODS = ['cash', 'card', 'account'] as const;

export interface IReturnItem {
  product?: Types.ObjectId | string | null;
  name: string;
  quantity: number;
  /** Refunded per unit, after any discount. */
  unitPrice: number;
  /** Discount given on this line at the return, in percent (open returns). */
  discountPct?: number;
  /** Refunded for the whole line. */
  total: number;
  /** For invoice returns: the line of the original sale this item came from. */
  orderLine?: number;
}

export interface IProductReturn extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  returnNo: string;
  type: (typeof RETURN_TYPES)[number];
  /** The original sale, for invoice returns. */
  orderId?: string | null;
  invoiceId?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  items: IReturnItem[];
  /** Refunded in all. */
  total: number;
  refundMethod: (typeof REFUND_METHODS)[number];
  /** How the refund was paid out: taken off the customer's account, cash and card. */
  refundToAccount: number;
  refundCash: number;
  refundCard: number;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>(
  {
    product: { type: Schema.Types.Mixed, default: null },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discountPct: { type: Number, min: 0, max: 100, default: 0 },
    total: { type: Number, required: true, min: 0 },
    orderLine: { type: Number },
  },
  { _id: false }
);

const ProductReturnSchema = new Schema<IProductReturn>(
  {
    returnNo: { type: String, required: true, trim: true },
    type: { type: String, enum: RETURN_TYPES, required: true },
    orderId: { type: String, default: null },
    invoiceId: { type: String, default: null },
    customerId: { type: String, default: null },
    customerName: { type: String, default: null },
    items: { type: [ReturnItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    refundMethod: { type: String, enum: REFUND_METHODS, required: true },
    refundToAccount: { type: Number, default: 0, min: 0 },
    refundCash: { type: Number, default: 0, min: 0 },
    refundCard: { type: Number, default: 0, min: 0 },
    reason: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

ProductReturnSchema.plugin(tenantScopePlugin);
ProductReturnSchema.index({ tenantId: 1, createdAt: -1 });
ProductReturnSchema.index({ tenantId: 1, orderId: 1 });
ProductReturnSchema.index({ tenantId: 1, customerId: 1 });

export const ProductReturn = mongoose.model<IProductReturn>('ProductReturn', ProductReturnSchema);
export default ProductReturn;
