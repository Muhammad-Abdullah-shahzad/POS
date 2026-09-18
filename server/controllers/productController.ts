/**
 * Product catalogue.
 *
 * Every query is scoped to the caller's company by the tenant plugin, so two
 * shops can stock the same barcode without ever seeing each other's stock.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { BadRequestError, NotFoundError } from '../core/errors';
import Product from '../models/Product';
import { searchFilter } from '../utils/query';
import {
  discardUpload,
  mirrorToDrive,
  publicImageUrl,
  removeStoredImage,
} from '../services/productImageService';

const generateSku = (): string => `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { search, category, limit } = (req.validatedQuery ?? {}) as {
    search?: string;
    category?: string;
    limit?: number;
  };

  const products = await Product.find({
    ...searchFilter(search, ['name', 'barcode', 'sku']),
    ...(category && { category }),
  })
    .sort({ name: 1 })
    .limit(limit ?? 200);

  res.json(successResponse(products));
});

export const getProductByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ barcode: req.params.barcode });
  if (!product) throw new NotFoundError('Product');

  res.json(successResponse(product));
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  try {
    const product = await Product.create({
      ...req.body,
      sku: req.body.sku || generateSku(),
      image: req.file ? publicImageUrl(req.user!.tenantId, req.file) : null,
    });

    if (req.file) mirrorToDrive(product.id, req.file);

    res.status(201).json(successResponse(product, 'Product created'));
  } catch (error) {
    // The image is only useful if the product row was written.
    await discardUpload(req.file);
    throw error;
  }
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Product.findById(req.params.id);
  if (!existing) {
    await discardUpload(req.file);
    throw new NotFoundError('Product');
  }

  const previousImage = existing.image ?? null;

  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, ...(req.file && { image: publicImageUrl(req.user!.tenantId, req.file) }) } },
      { returnDocument: 'after', runValidators: true }
    );

    if (req.file) mirrorToDrive(product!.id, req.file, previousImage);

    res.json(successResponse(product, 'Product updated'));
  } catch (error) {
    await discardUpload(req.file);
    throw error;
  }
});

/**
 * Adjust stock by a relative amount. Negative adjustments are rejected when
 * they would take the product below zero, so two tills selling the last unit
 * at once cannot both succeed.
 */
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const { quantity } = req.body as { quantity: number };

  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, ...(quantity < 0 && { stock: { $gte: Math.abs(quantity) } }) },
    { $inc: { stock: quantity } },
    { returnDocument: 'after' }
  );

  if (!product) {
    const exists = await Product.exists({ _id: req.params.id });
    if (!exists) throw new NotFoundError('Product');
    throw new BadRequestError('Not enough stock for this adjustment');
  }

  res.json(successResponse(product, 'Stock updated'));
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new NotFoundError('Product');

  await removeStoredImage(product.image);

  res.json(successResponse(null, 'Product deleted'));
});
