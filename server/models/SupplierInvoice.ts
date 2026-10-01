import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

/** How a supplier was paid. */
export const SUPPLIER_PAYMENT_METHODS = ['cash', 'card', 'bank', 'cheque'] as const;

/** One payment made against an invoice, kept so the supplier ledger can list it. */
export interface ISupplierPayment {
  amount: number;
  remarks?: string;
  paidAt: Date;
  /** Shared by the parts of one payment to a supplier that was spread over several invoices. */
  paymentId?: string;
  /** Cash, card, bank transfer or cheque; older payments did not record it. */
  method?: (typeof SUPPLIER_PAYMENT_METHODS)[number];
}

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
  /** Note entered with the invoice. */
  remarks?: string;
  /** Every payment, oldest first. Invoices from before this list existed may have none. */
  payments: ISupplierPayment[];
  lastPaymentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierPaymentSchema = new Schema<ISupplierPayment>(
  {
    amount: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true, default: '' },
    paidAt: { type: Date, required: true, default: Date.now },
    paymentId: { type: String },
    method: { type: String, enum: SUPPLIER_PAYMENT_METHODS },
  },
  { _id: false }
);

const SupplierInvoiceSchema = new Schema<ISupplierInvoice>(
  {
    supplierId: { type: String },
    supplierName: { type: String, required: true, trim: true },
    invoiceNo: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paid: { type: Number, required: true, default: 0, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    remarks: { type: String, trim: true, default: '' },
    payments: { type: [SupplierPaymentSchema], default: [] },
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
