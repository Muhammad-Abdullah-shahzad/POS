import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import Order from '../models/Order';
import ProductReturn from '../models/ProductReturn';
import { createReturn, returnableLines } from '../services/returnService';
import { searchFilter } from '../utils/query';

export const getReturns = asyncHandler(async (req: Request, res: Response) => {
  const { orderId, customerId, search } = (req.validatedQuery ?? {}) as { orderId?: string; customerId?: string; search?: string };
  const filter = {
    ...(orderId && { orderId }),
    ...(customerId && { customerId }),
    ...searchFilter(search, ['returnNo', 'invoiceId']),
  };
  res.json(successResponse(await ProductReturn.find(filter).sort({ createdAt: -1 }).limit(500)));
});

/** A sale with what can still be returned from each of its lines. */
export const getReturnableSale = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new NotFoundError('Sale');
  const earlier = await ProductReturn.find({ orderId: String(order._id) }).select('items');
  res.json(successResponse({ order, lines: returnableLines(order, earlier) }));
});

export const createProductReturn = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(successResponse(await createReturn(req.body), 'Return recorded'));
});
