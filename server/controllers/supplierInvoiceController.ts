import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import SupplierInvoice from '../models/SupplierInvoice';
import { recordSupplierPayment } from '../services/supplierInvoiceService';

export const getSupplierInvoices = asyncHandler(async (_req: Request, res: Response) => {
  const invoices = await SupplierInvoice.find().sort({ date: -1, createdAt: -1 });
  res.json(successResponse(invoices));
});

export const createSupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await SupplierInvoice.create(req.body);
  res.status(201).json(successResponse(invoice, 'Supplier invoice recorded'));
});

export const paySupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await recordSupplierPayment(String(req.params.id), req.body.amount);
  res.json(successResponse(invoice, 'Payment recorded'));
});

export const deleteSupplierInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await SupplierInvoice.findByIdAndDelete(req.params.id);
  if (!invoice) throw new NotFoundError('Supplier invoice');

  res.json(successResponse(null, 'Supplier invoice deleted'));
});
