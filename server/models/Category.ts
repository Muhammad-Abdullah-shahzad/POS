import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface ICategory extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
  items: string[];
  vatRate: number;
  vatType: 'inclusive' | 'exclusive';
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    items: [{ type: String }],
    vatRate: { type: Number, default: 0, min: 0 },
    vatType: { type: String, enum: ['inclusive', 'exclusive'], default: 'exclusive' },
  },
  { timestamps: true }
);

CategorySchema.plugin(tenantScopePlugin);
CategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
export default Category;
