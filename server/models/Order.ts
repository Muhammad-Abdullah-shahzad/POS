import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  product?: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  vatRate: number;
  vatAmount: number;
  totalPrice: number;
}

export interface IOrder extends Document {
  invoiceId: string;
  items: IOrderItem[];
  subtotal: number;
  totalVAT: number;
  discount: number;
  total: number;
  paymentMethod: string;
  splitCash?: number;
  splitCard?: number;
  status: 'completed' | 'voided';
  voidReason?: string;
  voidedAt?: Date;
  voidedBy?: mongoose.Types.ObjectId;
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
});

const OrderSchema = new Schema<IOrder>({
  invoiceId: { type: String, required: true, unique: true },
  items: [OrderItemSchema],
  subtotal: { type: Number, required: true },
  totalVAT: { type: Number, required: true },
  discount: { type: Number, required: true, default: 0 },
  total: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  splitCash: { type: Number, default: null },
  splitCard: { type: Number, default: null },
  status: { type: String, enum: ['completed', 'voided'], default: 'completed', index: true },
  voidReason: { type: String, default: null },
  voidedAt: { type: Date, default: null },
  voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model<IOrder>('Order', OrderSchema);
