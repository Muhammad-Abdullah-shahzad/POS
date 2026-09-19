import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

/**
 * A bill from a supplier and how much of it has been paid. The balance and
 * status (paid, partial, unpaid) follow from amount and paid, so they are
 * worked out when shown rather than stored.
 */
export interface ISupplierInvoice extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  /** The supplier record, when the invoice was raised against one. */
  supplierId?: string;
  supplierName: string;
  invoiceNo: string;
  amount: number;
  paid: number;
  date: Date;
  lastPaymentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierInvoiceSchema = new Schema<ISupplierInvoice>(
  {
    supplierId: { type: String },
    supplierName: { type: String, required: true, trim: true },
    invoiceNo: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, default: 0, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    lastPaymentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Payments go through a conditional update that enforces the same rule.
SupplierInvoiceSchema.pre('validate', function () {
  if (this.paid > this.amount) this.invalidate('paid', 'Paid cannot be more than the invoice amount');
});

SupplierInvoiceSchema.plugin(tenantScopePlugin);
SupplierInvoiceSchema.index({ tenantId: 1, date: -1 });
SupplierInvoiceSchema.index({ tenantId: 1, supplierName: 1 });

export const SupplierInvoice = mongoose.model<ISupplierInvoice>('SupplierInvoice', SupplierInvoiceSchema);
export default SupplierInvoice;
