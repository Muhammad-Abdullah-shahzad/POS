"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductHandlers = registerProductHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerProductHandlers() {
    electron_1.ipcMain.handle('products:getAll', (_e, search) => {
        if (search) {
            return (0, database_1.dbAll)(`SELECT * FROM products WHERE (name LIKE $s OR barcode LIKE $s) AND (deletedAt IS NULL) ORDER BY name ASC LIMIT 200`, { $s: `%${search}%` });
        }
        return (0, database_1.dbAll)('SELECT * FROM products WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    electron_1.ipcMain.handle('products:getByBarcode', (_e, barcode) => {
        return (0, database_1.dbGet)('SELECT * FROM products WHERE barcode = $barcode AND deletedAt IS NULL', { $barcode: barcode });
    });
    electron_1.ipcMain.handle('products:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO products
         (_id, name, sku, barcode, category, price, vatRate, vatType,
          costPrice, stock, drs, image, createdAt, updatedAt, isSync)
       VALUES
         ($id, $name, $sku, $barcode, $category, $price, $vatRate, $vatType,
          $costPrice, $stock, $drs, $image, $createdAt, $updatedAt, 0)`, {
            $id: _id,
            $name: (0, database_1.v)(data.name),
            $sku: (0, database_1.v)(data.sku),
            $barcode: (0, database_1.v)(data.barcode),
            $category: (0, database_1.v)(data.category),
            $price: (0, database_1.v)(data.price, 0),
            $vatRate: (0, database_1.v)(data.vatRate, 0),
            $vatType: (0, database_1.v)(data.vatType, 'exclusive'),
            $costPrice: (0, database_1.v)(data.costPrice, 0),
            $stock: (0, database_1.v)(data.stock, 0),
            $drs: (0, database_1.v)(data.drs, 0),
            $image: (0, database_1.v)(data.image),
            $createdAt: ts,
            $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM products WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('products:update', (_e, _id, data) => {
        (0, database_1.dbRun)(`UPDATE products SET
         name=$name, sku=$sku, barcode=$barcode, category=$category,
         price=$price, vatRate=$vatRate, vatType=$vatType,
         costPrice=$costPrice, stock=$stock, drs=$drs, image=$image,
         updatedAt=$ts, isSync=0
       WHERE _id=$id`, {
            $id: _id,
            $name: (0, database_1.v)(data.name),
            $sku: (0, database_1.v)(data.sku),
            $barcode: (0, database_1.v)(data.barcode),
            $category: (0, database_1.v)(data.category),
            $price: (0, database_1.v)(data.price, 0),
            $vatRate: (0, database_1.v)(data.vatRate, 0),
            $vatType: (0, database_1.v)(data.vatType, 'exclusive'),
            $costPrice: (0, database_1.v)(data.costPrice, 0),
            $stock: (0, database_1.v)(data.stock, 0),
            $drs: (0, database_1.v)(data.drs, 0),
            $image: (0, database_1.v)(data.image),
            $ts: (0, database_1.now)(),
        });
        return (0, database_1.dbGet)('SELECT * FROM products WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('products:updateStock', (_e, _id, quantity) => {
        (0, database_1.dbRun)(`UPDATE products SET stock = stock + $qty, updatedAt=$ts, isSync=0 WHERE _id=$id`, { $id: _id, $qty: quantity, $ts: (0, database_1.now)() });
        return (0, database_1.dbGet)('SELECT * FROM products WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('products:delete', (_e, _id) => {
        (0, database_1.softDelete)('products', _id);
        return { success: true };
    });
}
//# sourceMappingURL=products.js.map