import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export const ORDER_STATUSES = ['completed', 'voided'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrderItem {
  product?: Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  vatRate: number;
  vatAmount: number;
  totalPrice: number;
  discountPct?: number;
  discountAmt?: number;
  finalPrice?: number;
  drs?: number;
}

export interface IOrder extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  invoiceId: string;
  items: IOrderItem[];
  subtotal: number;
  totalVAT: number;
  discount: number;
  totalDRS?: number;
  total: number;
  paymentMethod: string;
  splitCash?: number | null;
  splitCard?: number | null;
  status: OrderStatus;
  voidReason?: string | null;
  voidedAt?: Date | null;
  voidedBy?: Types.ObjectId | null;
  voidedByEmployee?: Types.ObjectId | null;
  voidedByEmployeeName?: string | null;
  customerId?: Types.ObjectId | null;
  customerName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    vatAmount: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    discountPct: { type: Number, default: 0 },
    discountAmt: { type: Number, default: 0 },
    finalPrice: { type: Number },
    drs: { type: Number, default: 0 },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    invoiceId: { type: String, required: true },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    totalVAT: { type: Number, required: true },
    discount: { type: Number, required: true, default: 0 },
    totalDRS: { type: Number, default: 0 },
    total: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    splitCash: { type: Number, default: null },
    splitCard: { type: Number, default: null },
    status: { type: String, enum: ORDER_STATUSES, default: 'completed' },
    voidReason: { type: String, default: null },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    voidedByEmployee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
    voidedByEmployeeName: { type: String, default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerName: { type: String, default: null },
  },
  { timestamps: true }
);

OrderSchema.plugin(tenantScopePlugin);

// Receipt numbers restart per company, so uniqueness is scoped to the tenant.
OrderSchema.index({ tenantId: 1, invoiceId: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
