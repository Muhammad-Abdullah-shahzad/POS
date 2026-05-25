import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku?: string;
  barcode: string;
  category: string;
  price: number;
  vatRate: number;
  vatType: 'inclusive' | 'exclusive';
  costPrice: number;
  stock: number;
  drs?: number;
  image?: string;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  sku: { type: String, required: false, unique: true, sparse: true },
  barcode: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  vatRate: { type: Number, required: true },
  vatType: { type: String, enum: ['inclusive', 'exclusive'], required: true },
  costPrice: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  drs: { type: Number, default: 0 },
  image: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model<IProduct>('Product', ProductSchema);
