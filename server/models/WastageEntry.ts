import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export const WASTAGE_REASONS = ['Expired Stock', 'Damaged Packaging', 'Broken / Spilled', 'Theft / Inventory Shrinkage'] as const;
export type WastageReason = (typeof WASTAGE_REASONS)[number];

/**
 * Stock written off as waste. Product details are copied at the time, so the
 * log still reads correctly after a product is renamed, repriced or deleted.
 */
export interface IWastageEntry extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  /** Cost price per unit when written off. */
  unitCost: number;
  reason: WastageReason;
  date: Date;
  /** Id of the user who recorded it. */
  recordedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WastageEntrySchema = new Schema<IWastageEntry>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, default: '', trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, default: 0, min: 0 },
    reason: { type: String, enum: WASTAGE_REASONS, required: true },
    date: { type: Date, required: true, default: Date.now },
    recordedBy: { type: String },
  },
  { timestamps: true }
);

WastageEntrySchema.plugin(tenantScopePlugin);
WastageEntrySchema.index({ tenantId: 1, date: -1 });

export const WastageEntry = mongoose.model<IWastageEntry>('WastageEntry', WastageEntrySchema);
export default WastageEntry;
