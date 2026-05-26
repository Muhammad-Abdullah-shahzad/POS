import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  product?: mongoose.Types.ObjectId;
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

export interface IOrder extends Document {
  invoiceId: string;
  items: IOrderItem[];
  subtotal: number;
  totalVAT: number;
  discount: number;
  totalDRS?: number;
  total: number;
  paymentMethod: string;
  splitCash?: number;
  splitCard?: number;
  status: 'completed' | 'voided';
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: mongoose.Types.ObjectId;
  voidedByEmployee?: mongoose.Types.ObjectId;
  voidedByEmployeeName?: string;
  customerId?: mongoose.Types.ObjectId;
  customerName?: string;
  createdAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  vatRate: { type: Number, required: true },
  vatAmount: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  discountPct: { type: Number, default: 0 },
  discountAmt: { type: Number, default: 0 },
  finalPrice: { type: Number },
  drs: { type: Number, default: 0 },
});

const OrderSchema = new Schema<IOrder>({
  invoiceId: { type: String, required: true, unique: true },
  items: [OrderItemSchema],
  subtotal: { type: Number, required: true },
  totalVAT: { type: Number, required: true },
  discount: { type: Number, required: true, default: 0 },
  totalDRS: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  splitCash: { type: Number, default: null },
  splitCard: { type: Number, default: null },
  status: { type: String, enum: ['completed', 'voided'], default: 'completed', index: true },
  voidReason: { type: String, default: null },
  voidedAt: { type: Date, default: null },
  voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  voidedByEmployee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  voidedByEmployeeName: { type: String, default: null },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  customerName: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model<IOrder>('Order', OrderSchema);
