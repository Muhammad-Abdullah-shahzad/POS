import { Request, Response } from 'express';
import ExpenseCategory from '../models/ExpenseCategory';
import { successResponse, errorResponse } from '../utils/response';

export const getExpenseCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.json(successResponse(categories));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createExpenseCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await ExpenseCategory.create(req.body);
    res.status(201).json(successResponse(category, 'Category created'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const deleteExpenseCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    await ExpenseCategory.findByIdAndDelete(req.params.id);
    res.json(successResponse(null, 'Category deleted'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
