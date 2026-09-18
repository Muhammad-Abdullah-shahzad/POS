import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import ExpenseCategory from '../models/ExpenseCategory';

export const getExpenseCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await ExpenseCategory.find().sort({ name: 1 });
  res.json(successResponse(categories));
});

export const createExpenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await ExpenseCategory.create(req.body);
  res.status(201).json(successResponse(category, 'Category created'));
});

export const deleteExpenseCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await ExpenseCategory.findByIdAndDelete(req.params.id);
  if (!category) throw new NotFoundError('Category');

  res.json(successResponse(null, 'Category deleted'));
});
