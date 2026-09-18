import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import Expense from '../models/Expense';

export const getExpenses = asyncHandler(async (_req: Request, res: Response) => {
  const expenses = await Expense.find().sort({ date: -1 });
  res.json(successResponse(expenses));
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await Expense.create(req.body);
  res.status(201).json(successResponse(expense, 'Expense recorded'));
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!expense) throw new NotFoundError('Expense');

  res.json(successResponse(expense, 'Expense updated'));
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) throw new NotFoundError('Expense');

  res.json(successResponse(null, 'Expense deleted'));
});
