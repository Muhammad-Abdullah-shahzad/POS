import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  items: string[];
  vatRate: number;
  vatType: 'inclusive' | 'exclusive';
}

const CategorySchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  items: [{ type: String }],
  vatRate: { type: Number, default: 0 },
  vatType: { type: String, enum: ['inclusive', 'exclusive'], default: 'exclusive' },
}, { timestamps: true });

export default mongoose.model<ICategory>('Category', CategorySchema);
