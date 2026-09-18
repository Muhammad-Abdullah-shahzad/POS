import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import Supplier from '../models/Supplier';
import { searchFilter } from '../utils/query';

export const getSuppliers = asyncHandler(async (req: Request, res: Response) => {
  const search = req.validatedQuery?.search as string | undefined;
  const suppliers = await Supplier.find(searchFilter(search, ['name', 'contact', 'emailId'])).sort({
    createdAt: -1,
  });

  res.json(successResponse(suppliers));
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.create(req.body);
  res.status(201).json(successResponse(supplier, 'Supplier created'));
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!supplier) throw new NotFoundError('Supplier');

  res.json(successResponse(supplier, 'Supplier updated'));
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new NotFoundError('Supplier');

  res.json(successResponse(null, 'Supplier deleted'));
});
