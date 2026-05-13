import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  contact: string;
  emailId: string;
  address: string;
}

const SupplierSchema: Schema = new Schema({
  name: { type: String, required: true },
  contact: { type: String, required: true },
  emailId: { type: String, required: true },
  address: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);
