import { Request, Response } from 'express';
import Expense from '../models/Expense';
import { successResponse, errorResponse } from '../utils/response';

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(successResponse(expenses));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(successResponse(expense, 'Expense recorded'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};
