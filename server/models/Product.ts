import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  price: number;
  vatRate: number;
  vatType: 'inclusive' | 'exclusive';
  costPrice: number;
  stock: number;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: true, unique: true },
  barcode: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  vatRate: { type: Number, required: true },
  vatType: { type: String, enum: ['inclusive', 'exclusive'], required: true },
  costPrice: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export default mongoose.model<IProduct>('Product', ProductSchema);
