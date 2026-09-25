/**
 * Customer payment ledger entries.
 *
 * Each record represents a payment a customer made towards clearing their
 * outstanding credit balance. Mirrors the SQLite `customer_payments` table in
 * the Electron desktop app for seamless two-way sync.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface ICustomerPayment extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  customerId: Types.ObjectId;
  customerName: string;
  amountPaid: number;
  paymentMethod: string;
  date: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerPaymentSchema = new Schema<ICustomerPayment>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerName: { type: String, required: true, trim: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

CustomerPaymentSchema.plugin(tenantScopePlugin);
CustomerPaymentSchema.index({ tenantId: 1, customerId: 1 });

export const CustomerPayment = mongoose.model<ICustomerPayment>('CustomerPayment', CustomerPaymentSchema);
export default CustomerPayment;
