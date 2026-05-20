import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  contactNum1: string;
  contactNum2?: string;
  email?: string;
  address?: string;
  eircode?: string;
  qrCode?: string;
  barcode?: string;
  birthday?: Date;
  anniversary?: Date;
  timesVisited: number;
  totalAmount: number;
  lastVisit?: string;
}

const CustomerSchema: Schema = new Schema({
  name: { type: String, required: true },
  contactNum1: { type: String, required: true, index: true },
  contactNum2: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  eircode: { type: String, default: '' },
  qrCode: { type: String, default: '' },
  barcode: { type: String, default: '' },
  birthday: { type: Date, default: null },
  anniversary: { type: Date, default: null },
  timesVisited: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  lastVisit: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
