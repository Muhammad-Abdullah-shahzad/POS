import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { ConflictError, NotFoundError } from '../core/errors';
import Category from '../models/Category';
import Product from '../models/Product';

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json(successResponse(categories));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.create(req.body);
  res.status(201).json(successResponse(category, 'Category created'));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!category) throw new NotFoundError('Category');

  res.json(successResponse(category, 'Category updated'));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new NotFoundError('Category');

  // Products name their category, so deleting one still in use would leave
  // them pointing at nothing.
  const inUse = await Product.countDocuments({ category: category.name });
  if (inUse > 0) {
    throw new ConflictError(`Move the ${inUse} product(s) in "${category.name}" to another category first`);
  }

  await category.deleteOne();

  res.json(successResponse(null, 'Category deleted'));
});
