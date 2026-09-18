import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface ICustomer extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
  contactNum1: string;
  contactNum2?: string;
  email?: string;
  address?: string;
  eircode?: string;
  qrCode?: string;
  barcode?: string;
  birthday?: Date | null;
  anniversary?: Date | null;
  timesVisited: number;
  totalAmount: number;
  lastVisit?: string;
  loyaltyPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    contactNum1: { type: String, required: true, trim: true },
    contactNum2: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    address: { type: String, default: '' },
    eircode: { type: String, default: '' },
    qrCode: { type: String, default: '' },
    barcode: { type: String, default: '' },
    birthday: { type: Date, default: null },
    anniversary: { type: Date, default: null },
    timesVisited: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0 },
    lastVisit: { type: String, default: '' },
    loyaltyPoints: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

CustomerSchema.plugin(tenantScopePlugin);
CustomerSchema.index({ tenantId: 1, contactNum1: 1 });
CustomerSchema.index({ tenantId: 1, name: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
export default Customer;
