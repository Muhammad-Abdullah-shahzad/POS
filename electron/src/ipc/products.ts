import { ipcMain } from 'electron';
import { dbAll, dbGet, dbRun, generateLocalId, now, v, softDelete } from '../db/database';

export function registerProductHandlers(): void {

  ipcMain.handle('products:getAll', (_e, search?: string) => {
    if (search) {
      return dbAll(
        `SELECT * FROM products WHERE (name LIKE $s OR barcode LIKE $s) AND (deletedAt IS NULL) ORDER BY name ASC LIMIT 200`,
        { $s: `%${search}%` }
      );
    }
    return dbAll('SELECT * FROM products WHERE deletedAt IS NULL ORDER BY name ASC');
  });

  ipcMain.handle('products:getByBarcode', (_e, barcode: string) => {
    return dbGet('SELECT * FROM products WHERE barcode = $barcode AND deletedAt IS NULL', { $barcode: barcode });
  });

  ipcMain.handle('products:create', (_e, data: Record<string, unknown>) => {
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

  ipcMain.handle('products:update', (_e, _id: string, data: Record<string, unknown>) => {
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

  ipcMain.handle('products:updateStock', (_e, _id: string, quantity: number) => {
    dbRun(
      `UPDATE products SET stock = stock + $qty, updatedAt=$ts, isSync=0 WHERE _id=$id`,
      { $id: _id, $qty: quantity, $ts: now() }
    );
    return dbGet('SELECT * FROM products WHERE _id = $id', { $id: _id });
  });

  ipcMain.handle('products:delete', (_e, _id: string) => {
    softDelete('products', _id);
    return { success: true };
  });
}
