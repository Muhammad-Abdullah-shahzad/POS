import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import WastageEntry from '../models/WastageEntry';
import { recordWastage } from '../services/wastageService';

/** The log is for review, so the most recent entries are enough. */
const LOG_LIMIT = 500;

export const getWastage = asyncHandler(async (_req: Request, res: Response) => {
  const entries = await WastageEntry.find().sort({ date: -1 }).limit(LOG_LIMIT);
  res.json(successResponse(entries));
});

export const createWastage = asyncHandler(async (req: Request, res: Response) => {
  const entry = await recordWastage(req.body, req.user?.id);
  res.status(201).json(successResponse(entry, 'Wastage recorded'));
});
