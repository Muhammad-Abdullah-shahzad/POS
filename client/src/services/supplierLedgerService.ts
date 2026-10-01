/**
 * Corrections to a supplier's ledger, made from the ledger statement. The
 * server (or the desktop app) applies the rules, so they live in one place:
 * an invoice cannot drop below what was paid on it, and a corrected payment
 * is spread again over the supplier's invoices.
 */
import api from './api';
import type { PaymentRef, SupplierPaymentMethod } from '../features/suppliers/supplierStatement';

export interface InvoiceCorrection {
  amount?: number;
  remarks?: string;
}

export interface SupplierPaymentCorrection {
  amount?: number;
  remarks?: string;
  method?: SupplierPaymentMethod;
}

export const correctSupplierInvoice = (invoiceId: string, changes: InvoiceCorrection) =>
  api.patch(`/supplier-invoices/${invoiceId}`, changes);

export const correctSupplierPayment = (ref: PaymentRef, changes: SupplierPaymentCorrection) =>
  'paymentId' in ref
    ? api.patch(`/supplier-invoices/payments/${ref.paymentId}`, changes)
    : api.patch(`/supplier-invoices/${ref.invoiceId}/payments/${ref.index}`, changes);
