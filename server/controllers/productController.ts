/**
 * Product catalogue.
 *
 * Every query is scoped to the caller's company by the tenant plugin, so two
 * shops can stock the same barcode without ever seeing each other's stock.
 */
import { Request, Response } from 'express';
import type { SortOrder } from 'mongoose';
import { z } from 'zod';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { BadRequestError, NotFoundError } from '../core/errors';
import Product from '../models/Product';
import { quickSearchProducts, searchProductPage } from '../services/productSearchService';
import { LOW_STOCK_THRESHOLD } from '../services/kpiService';
import { pageOf, pageWindow } from '../utils/pagination';
import { productSearchQuery } from '../validators/productValidators';
import { isDataUrlImage, removeStoredImage, storeDataUrlImage, storeUploadedImage } from '../services/imageStorageService';

/**
 * A new product photo, stored on Drive: uploaded as a file, or sent inline as
 * base64. Returns its link, or null when the request has no new photo.
 */
async function storeIncomingImage(req: Request): Promise<string | null> {
  const tenantId = req.user!.tenantId;
  if (req.file) return storeUploadedImage('products', tenantId, req.file);
  if (isDataUrlImage(req.body?.image)) return storeDataUrlImage('products', tenantId, req.body.image);
  return null;
}

const generateSku = (): string => `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

/** Products a plain list returns when the caller names no limit. */
const DEFAULT_LIST_LIMIT = 200;

/**
 * GET /products
 *
 * With `page`, one page of the catalogue plus the total, for the products
 * screen: `?page=2&pageSize=25&search=pipe`. Without it, a plain list: with a
 * `search`, every match best first (the till's search) unless `limit` caps it;
 * without one, up to `limit` (200 by default).
 *
 * `lowStock=true` (with `page`) lists only products running low, emptiest
 * first: the dashboard's restock list, which can run to thousands.
 *
 * Every search is the smart search (productSearchService): words in any
 * order, small typos forgiven, best matches first.
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { search, category, limit, page, pageSize, lowStock } = req.validatedQuery as z.infer<typeof productSearchQuery>;
  const filter = {
    ...(category && { category }),
    ...(lowStock && { stock: { $lte: LOW_STOCK_THRESHOLD } }),
  };
  const query = search?.trim();

  if (page === undefined) {
    // The till's search: every match, best first, unless the caller asks for a limit.
    const products = query
      ? await quickSearchProducts(query, { category, limit })
      : await Product.find(filter).sort({ name: 1 }).limit(limit ?? DEFAULT_LIST_LIMIT);
    res.json(successResponse(products));
    return;
  }

  const { skip, limit: take } = pageWindow(page, pageSize);
  if (query) {
    const { items, total } = await searchProductPage(query, filter, { skip, limit: take });
    res.json(successResponse(pageOf(items, total, page, pageSize)));
    return;
  }

  // _id breaks ties between equal names, so no product repeats or goes missing between pages.
  const order: Record<string, SortOrder> = lowStock ? { stock: 1, name: 1, _id: 1 } : { name: 1, _id: 1 };
  const [items, total] = await Promise.all([
    Product.find(filter).sort(order).skip(skip).limit(take),
    Product.countDocuments(filter),
  ]);
  res.json(successResponse(pageOf(items, total, page, pageSize)));
});

export const getProductByBarcode = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findOne({ barcode: req.params.barcode });
  if (!product) throw new NotFoundError('Product');

  res.json(successResponse(product));
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  // The image goes to Drive first; only its link is stored with the product.
  const image = await storeIncomingImage(req);

  try {
    const product = await Product.create({ ...req.body, sku: req.body.sku || generateSku(), image });
    res.status(201).json(successResponse(product, 'Product created'));
  } catch (error) {
    // The image is only useful if the product was saved.
    await removeStoredImage(image);
    throw error;
  }
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Product.findById(req.params.id);
  if (!existing) throw new NotFoundError('Product');

  const image = await storeIncomingImage(req);

  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: { ...req.body, ...(image && { image }) } },
      { returnDocument: 'after', runValidators: true }
    );

    // A replaced image is removed only once the new one is saved.
    if (image && existing.image && existing.image !== image) await removeStoredImage(existing.image);
    res.json(successResponse(product, 'Product updated'));
  } catch (error) {
    await removeStoredImage(image);
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
