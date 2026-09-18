import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface IProduct extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
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
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    barcode: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, required: true, min: 0 },
    vatType: { type: String, enum: ['inclusive', 'exclusive'], required: true },
    costPrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, default: 0 },
    drs: { type: Number, default: 0 },
    image: { type: String, default: null },
  },
  { timestamps: true }
);

ProductSchema.plugin(tenantScopePlugin);

// Barcodes and SKUs are unique inside a company, not across the platform —
// two shops may legitimately stock the same article.
ProductSchema.index({ tenantId: 1, barcode: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string' } } });
ProductSchema.index({ tenantId: 1, name: 1 });
ProductSchema.index({ tenantId: 1, category: 1 });
ProductSchema.index({ tenantId: 1, stock: 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
export default Product;
