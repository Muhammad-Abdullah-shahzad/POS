"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductHandlers = registerProductHandlers;
const licenseGuard_1 = require("../license/licenseGuard");
const database_1 = require("../db/database");
/** Largest page the products screen may ask for, matching the server. */
const MAX_PAGE_SIZE = 100;
/** Escape LIKE wildcards so a search for "50%" matches that text literally. */
const likeContains = (term) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
function registerProductHandlers() {
    (0, licenseGuard_1.handleLicensed)('products:getAll', (_e, search) => {
        if (search) {
            return (0, database_1.dbAll)(`SELECT * FROM products WHERE (name LIKE $s OR barcode LIKE $s) AND (deletedAt IS NULL) ORDER BY name ASC LIMIT 200`, { $s: `%${search}%` });
        }
        return (0, database_1.dbAll)('SELECT * FROM products WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    // One page of the catalogue, in the same shape the server returns.
    (0, licenseGuard_1.handleLicensed)('products:getPage', (_e, query = {}) => {
        const page = Math.max(1, Math.floor(Number(query.page) || 1));
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.pageSize) || 25)));
        const search = query.search?.trim();
        const where = search
            ? `deletedAt IS NULL AND (name LIKE $s ESCAPE '\\' OR barcode LIKE $s ESCAPE '\\' OR sku LIKE $s ESCAPE '\\')`
            : 'deletedAt IS NULL';
        const params = search ? { $s: likeContains(search) } : {};
        const { total } = (0, database_1.dbGet)(`SELECT COUNT(*) AS total FROM products WHERE ${where}`, params);
        const items = (0, database_1.dbAll)(`SELECT * FROM products WHERE ${where} ORDER BY name ASC, _id ASC LIMIT $limit OFFSET $offset`, {
            ...params,
            $limit: pageSize,
            $offset: (page - 1) * pageSize,
        });
        return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
    });
    (0, licenseGuard_1.handleLicensed)('products:getByBarcode', (_e, barcode) => {
        return (0, database_1.dbGet)('SELECT * FROM products WHERE barcode = $barcode AND deletedAt IS NULL', { $barcode: barcode });
    });
    (0, licenseGuard_1.handleLicensed)('products:create', (_e, data) => {
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
    (0, licenseGuard_1.handleLicensed)('products:update', (_e, _id, data) => {
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
    (0, licenseGuard_1.handleLicensed)('products:updateStock', (_e, _id, quantity) => {
        (0, database_1.dbRun)(`UPDATE products SET stock = stock + $qty, updatedAt=$ts, isSync=0 WHERE _id=$id`, { $id: _id, $qty: quantity, $ts: (0, database_1.now)() });
        return (0, database_1.dbGet)('SELECT * FROM products WHERE _id = $id', { $id: _id });
    });
    (0, licenseGuard_1.handleLicensed)('products:delete', (_e, _id) => {
        (0, database_1.softDelete)('products', _id);
        return { success: true };
    });
}
//# sourceMappingURL=products.js.map