import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import Order from '../models/Order';
import * as orderService from '../services/orderService';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createOrder(req.body);
  res.status(201).json(successResponse(order, 'Order completed'));
});

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const { month, year, limit } = (req.validatedQuery ?? {}) as {
    month?: number;
    year?: number;
    limit?: number;
  };

  const period =
    month && year
      ? { createdAt: { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) } }
      : {};

  const orders = await Order.find({ status: { $ne: 'voided' }, ...period })
    .sort({ createdAt: -1 })
    .limit(limit ?? 200);

  res.json(successResponse(orders));
});

export const getVoidedOrders = asyncHandler(async (_req: Request, res: Response) => {
  const orders = await Order.find({ status: 'voided' })
    .populate('voidedBy', 'name email role')
    .populate('voidedByEmployee', 'name role emailId')
    .sort({ voidedAt: -1, createdAt: -1 })
    .limit(500);

  res.json(successResponse(orders));
});

export const voidOrder = asyncHandler(async (req: Request, res: Response) => {
  // The till sends the reason on the query string; older builds send a body.
  const input = { ...(req.body ?? {}), ...(req.validatedQuery ?? {}) } as {
    reason: string;
    employeeId?: string;
    employeeName?: string;
  };

  const order = await orderService.voidOrder(String(req.params.id), {
    reason: input.reason,
    voidedByUserId: req.user?.id,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
  });

  res.json(successResponse(order, 'Order voided'));
});
