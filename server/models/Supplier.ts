import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface ISupplier extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
  contact: string;
  emailId: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    emailId: { type: String, required: true, lowercase: true, trim: true },
    address: { type: String, required: true },
  },
  { timestamps: true }
);

SupplierSchema.plugin(tenantScopePlugin);
SupplierSchema.index({ tenantId: 1, name: 1 });

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema);
export default Supplier;
