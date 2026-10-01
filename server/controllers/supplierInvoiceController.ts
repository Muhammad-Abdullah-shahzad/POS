import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { ConflictError, NotFoundError } from '../core/errors';
import SupplierInvoice from '../models/SupplierInvoice';
import Supplier from '../models/Supplier';
import { sameValueFilter } from '../utils/query';
import { paySupplier, recordSupplierPayment } from '../services/supplierInvoiceService';
import * as ledger from '../services/supplierLedgerService';

export const getSupplierInvoices = asyncHandler(async (_req: Request, res: Response) => {
  const invoices = await SupplierInvoice.find().sort({ date: -1, createdAt: -1 });
  res.json(successResponse(invoices));
});

export const createSupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  // An invoice number is recorded once across the company, so a bill cannot be entered twice.
  const duplicate = await SupplierInvoice.findOne(sameValueFilter('invoiceNo', String(req.body.invoiceNo ?? ''))).select('invoiceNo supplierName');
  if (duplicate) {
    throw new ConflictError(`Invoice ${duplicate.invoiceNo} is already recorded (supplier: ${duplicate.supplierName})`);
  }
  // Ledgers are kept per supplier name, so a saved supplier's exact spelling is used.
  const supplier = await Supplier.findOne(sameValueFilter('name', String(req.body.supplierName ?? ''))).select('name');
  // Money paid when the invoice is entered is the first line of its payment history.
  const paid = Number(req.body.paid) || 0;
  const invoice = await SupplierInvoice.create({
    ...req.body,
    ...(supplier ? { supplierName: supplier.name, supplierId: String(supplier._id) } : {}),
    payments:
      paid > 0
        ? [{ amount: paid, remarks: 'Paid when the invoice was recorded', paidAt: new Date(), paymentId: new Types.ObjectId().toString(), method: 'cash' }]
        : [],
    lastPaymentAt: paid > 0 ? new Date() : null,
  });
  res.status(201).json(successResponse(invoice, 'Supplier invoice recorded'));
});

export const paySupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await recordSupplierPayment(String(req.params.id), req.body.amount, req.body.remarks);
  res.json(successResponse(invoice, 'Payment recorded'));
});

export const paySupplierAccount = asyncHandler(async (req: Request, res: Response) => {
  const { supplierName, amount, remarks, method } = req.body;
  const outcome = await paySupplier(supplierName, amount, remarks, method);
  res.json(successResponse(outcome, 'Payment recorded'));
});

export const deleteSupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await SupplierInvoice.findByIdAndDelete(req.params.id);
  if (!invoice) throw new NotFoundError('Supplier invoice');

  res.json(successResponse(null, 'Supplier invoice deleted'));
});

/** Correct an invoice's amount or remarks, from the ledger statement. */
export const updateSupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  res.json(successResponse(await ledger.updateInvoice(String(req.params.id), req.body), 'Invoice updated'));
});

/** Correct a payment's amount, remarks or method; its shares across invoices follow. */
export const updateSupplierPayment = asyncHandler(async (req: Request, res: Response) => {
  res.json(successResponse(await ledger.updatePayment(String(req.params.paymentId), req.body), 'Payment updated'));
});

/** The same, for a payment recorded before payments had ids. */
export const updateLegacySupplierPayment = asyncHandler(async (req: Request, res: Response) => {
  const paymentId = await ledger.identifyPayment(String(req.params.id), Number(req.params.index));
  res.json(successResponse(await ledger.updatePayment(paymentId, req.body), 'Payment updated'));
});
