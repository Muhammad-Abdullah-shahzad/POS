import { Request, Response } from 'express';
import Category from '../models/Category';
import { successResponse, errorResponse } from '../utils/response';

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find();
    res.json(successResponse(categories));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.create(req.body);
    res.status(201).json(successResponse(category, 'Category created successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) {
      res.status(404).json(errorResponse('Category not found'));
      return;
    }
    res.json(successResponse(category, 'Category updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      res.status(404).json(errorResponse('Category not found'));
      return;
    }
    res.json(successResponse(null, 'Category deleted successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
