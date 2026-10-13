/**
 * Product search for the till and the products screen: the smart search in
 * smartSearch.ts (words in any order, small typos forgiven, sizes exact),
 * best matches first.
 *
 * Ranking needs every candidate's name, so it runs over the company's
 * catalogue (name, barcode and SKU only: a few thousand short rows), then
 * loads just the products to show.
 *
 * Mirrored by electron/src/ipc/products.ts for the desktop till.
 */
import type { QueryFilter, Types } from 'mongoose';
import Product, { IProduct } from '../models/Product';
import { rankProducts } from './smartSearch';

/** Ids of the products matching `search` within `filter`, best first. */
async function rankedIds(search: string, filter: QueryFilter<IProduct>): Promise<Types.ObjectId[]> {
  const candidates = await Product.find(filter, { name: 1, barcode: 1, sku: 1 }).lean();
  return rankProducts(candidates, search).map((product) => product._id as Types.ObjectId);
}

/** The products with these ids, in the same order. */
async function loadInOrder(ids: Types.ObjectId[]): Promise<IProduct[]> {
  if (ids.length === 0) return [];
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((product) => [String(product._id), product]));
  return ids.map((id) => byId.get(String(id))).filter((product): product is NonNullable<typeof product> => Boolean(product));
}

/**
 * The till's search: every match, best first, unless the caller asks for a
 * limit (the search narrows the list, so the till's search has no cap).
 */
export async function quickSearchProducts(search: string, options: { category?: string; limit?: number } = {}): Promise<IProduct[]> {
  const ids = await rankedIds(search, options.category ? { category: options.category } : {});
  return loadInOrder(options.limit ? ids.slice(0, options.limit) : ids);
}

/** One page of the matches for the products screen, with the total for the page controls. */
export async function searchProductPage(
  search: string,
  filter: QueryFilter<IProduct>,
  { skip, limit }: { skip: number; limit: number }
): Promise<{ items: IProduct[]; total: number }> {
  const ids = await rankedIds(search, filter);
  return { items: await loadInOrder(ids.slice(skip, skip + limit)), total: ids.length };
}
