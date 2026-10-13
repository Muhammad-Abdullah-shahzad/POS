import { handleLicensed } from '../license/licenseGuard';
import { BindMap, dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';
import { LOW_STOCK_THRESHOLD } from './analytics';
import { rankProducts } from '../search/smartSearch';

/** Largest page the products screen may ask for, matching the server. */
const MAX_PAGE_SIZE = 100;

export interface ProductPageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  /** Only products running low, emptiest first (the dashboard's restock list). */
  lowStock?: boolean;
}

const LIVE = "(deletedAt IS NULL OR deletedAt = '')";
/** Rows bound per IN (...) query; SQLite allows 999 parameters. */
const ID_CHUNK = 500;

/**
 * Product search for the till and the products screen: the smart search in
 * ../search/smartSearch.ts (words in any order, small typos forgiven, sizes
 * exact), best matches first. Ranks the catalogue's names, then loads just
 * the rows to show. Mirrors server/services/productSearchService.ts.
 */
function rankedIds(search: string, where: string): string[] {
  const candidates = dbAll(`SELECT _id, name, barcode, sku FROM products WHERE ${where}`);
  return rankProducts(candidates, search).map((row) => String(row._id));
}

/** The products with these ids, in the same order. */
function loadInOrder(ids: string[]): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const chunk = ids.slice(start, start + ID_CHUNK);
    const params: BindMap = Object.fromEntries(chunk.map((id, i) => [`$id${i}`, id]));
    const rows = dbAll(`SELECT * FROM products WHERE _id IN (${chunk.map((_, i) => `$id${i}`).join(', ')})`, params);
    for (const row of rows) byId.set(String(row._id), row);
  }
  return ids.map((id) => byId.get(id)).filter((row): row is Record<string, unknown> => Boolean(row));
}

export function registerProductHandlers(): void {

  handleLicensed('products:getAll', (_e, search?: string) => {
    if (search?.trim()) return loadInOrder(rankedIds(search.trim(), LIVE));
    return dbAll('SELECT * FROM products WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  // One page of the catalogue, in the same shape the server returns.
  handleLicensed('products:getPage', (_e, query: ProductPageQuery = {}) => {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.pageSize) || 25)));
    const search = query.search?.trim();

    const where = query.lowStock ? `${LIVE} AND stock <= ${LOW_STOCK_THRESHOLD}` : LIVE;
    const pageOf = (items: Record<string, unknown>[], total: number) =>
      ({ items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });

    // A search lists the smart search's matches, best first.
    if (search) {
      const ids = rankedIds(search, where);
      return pageOf(loadInOrder(ids.slice((page - 1) * pageSize, page * pageSize)), ids.length);
    }

    const order = query.lowStock ? 'stock ASC, name ASC, _id ASC' : 'name ASC, _id ASC';
    const { total } = dbGet(`SELECT COUNT(*) AS total FROM products WHERE ${where}`) as { total: number };
    const items = dbAll(`SELECT * FROM products WHERE ${where} ORDER BY ${order} LIMIT $limit OFFSET $offset`, {
      $limit: pageSize,
      $offset: (page - 1) * pageSize,
    });
    return pageOf(items, total);
  });

  handleLicensed('products:getByBarcode', (_e, barcode: string) => {
    return dbGet('SELECT * FROM products WHERE barcode = $barcode AND deletedAt IS NULL', { $barcode: barcode });
  });

  handleLicensed('products:create', (_e, data: Record<string, unknown>) => {
    const _id = generateLocalId();
    const ts = now();
    dbRun(
      `INSERT INTO products
         (_id, name, sku, barcode, category, price, vatRate, vatType,
          costPrice, stock, drs, image, createdAt, updatedAt, isSync)
       VALUES
         ($id, $name, $sku, $barcode, $category, $price, $vatRate, $vatType,
          $costPrice, $stock, $drs, $image, $createdAt, $updatedAt, 0)`,
      {
        $id: _id,
        $name: v(data.name),
        $sku: v(data.sku),
        $barcode: v(data.barcode),
        $category: v(data.category),
        $price: v(data.price, 0),
        $vatRate: v(data.vatRate, 0),
        $vatType: v(data.vatType, 'exclusive'),
        $costPrice: v(data.costPrice, 0),
        $stock: v(data.stock, 0),
        $drs: v(data.drs, 0),
        $image: v(data.image),
        $createdAt: ts,
        $updatedAt: ts,
      }
    );
    return dbGet('SELECT * FROM products WHERE _id = $id', { $id: _id });
  });

  handleLicensed('products:update', (_e, _id: string, data: Record<string, unknown>) => {
    dbRun(
      `UPDATE products SET
         name=$name, sku=$sku, barcode=$barcode, category=$category,
         price=$price, vatRate=$vatRate, vatType=$vatType,
         costPrice=$costPrice, stock=$stock, drs=$drs, image=$image,
         updatedAt=$ts, isSync=0
       WHERE _id=$id`,
      {
        $id: _id,
        $name: v(data.name),
        $sku: v(data.sku),
        $barcode: v(data.barcode),
        $category: v(data.category),
        $price: v(data.price, 0),
        $vatRate: v(data.vatRate, 0),
        $vatType: v(data.vatType, 'exclusive'),
        $costPrice: v(data.costPrice, 0),
        $stock: v(data.stock, 0),
        $drs: v(data.drs, 0),
        $image: v(data.image),
        $ts: now(),
      }
    );
    return dbGet('SELECT * FROM products WHERE _id = $id', { $id: _id });
  });

  handleLicensed('products:updateStock', (_e, _id: string, quantity: number) => {
    dbRun(
      `UPDATE products SET stock = stock + $qty, updatedAt=$ts, isSync=0 WHERE _id=$id`,
      { $id: _id, $qty: quantity, $ts: now() }
    );
    return dbGet('SELECT * FROM products WHERE _id = $id', { $id: _id });
  });

  handleLicensed('products:delete', (_e, _id: string) => {
    softDelete('products', _id);
    return { success: true };
  });
}
