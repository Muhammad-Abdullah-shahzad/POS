import { handleLicensed } from '../license/licenseGuard';
import { BindMap, dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

/** Largest page the products screen may ask for, matching the server. */
const MAX_PAGE_SIZE = 100;

export interface ProductPageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

/** Escape LIKE wildcards so a search for "50%" matches that text literally. */
const likeContains = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function registerProductHandlers(): void {

  handleLicensed('products:getAll', (_e, search?: string) => {
    if (search) {
      return dbAll(
        `SELECT * FROM products WHERE (name LIKE $s OR barcode LIKE $s) AND (deletedAt IS NULL) ORDER BY name ASC LIMIT 200`,
        { $s: `%${search}%` }
      );
    }
    return dbAll('SELECT * FROM products WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  // One page of the catalogue, in the same shape the server returns.
  handleLicensed('products:getPage', (_e, query: ProductPageQuery = {}) => {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.pageSize) || 25)));
    const search = query.search?.trim();

    const where = search
      ? `deletedAt IS NULL AND (name LIKE $s ESCAPE '\\' OR barcode LIKE $s ESCAPE '\\' OR sku LIKE $s ESCAPE '\\')`
      : 'deletedAt IS NULL';
    const params: BindMap = search ? { $s: likeContains(search) } : {};

    const { total } = dbGet(`SELECT COUNT(*) AS total FROM products WHERE ${where}`, params) as { total: number };
    const items = dbAll(`SELECT * FROM products WHERE ${where} ORDER BY name ASC, _id ASC LIMIT $limit OFFSET $offset`, {
      ...params,
      $limit: pageSize,
      $offset: (page - 1) * pageSize,
    });

    return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
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
