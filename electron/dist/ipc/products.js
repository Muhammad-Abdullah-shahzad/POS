"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductHandlers = registerProductHandlers;
const licenseGuard_1 = require("../license/licenseGuard");
const database_1 = require("../db/database");
const analytics_1 = require("./analytics");
const smartSearch_1 = require("../search/smartSearch");
/** Largest page the products screen may ask for, matching the server. */
const MAX_PAGE_SIZE = 100;
const LIVE = "(deletedAt IS NULL OR deletedAt = '')";
/** Rows bound per IN (...) query; SQLite allows 999 parameters. */
const ID_CHUNK = 500;
/**
 * Product search for the till and the products screen: the smart search in
 * ../search/smartSearch.ts (words in any order, small typos forgiven, sizes
 * exact), best matches first. Ranks the catalogue's names, then loads just
 * the rows to show. Mirrors server/services/productSearchService.ts.
 */
function rankedIds(search, where) {
    const candidates = (0, database_1.dbAll)(`SELECT _id, name, barcode, sku FROM products WHERE ${where}`);
    return (0, smartSearch_1.rankProducts)(candidates, search).map((row) => String(row._id));
}
/** The products with these ids, in the same order. */
function loadInOrder(ids) {
    const byId = new Map();
    for (let start = 0; start < ids.length; start += ID_CHUNK) {
        const chunk = ids.slice(start, start + ID_CHUNK);
        const params = Object.fromEntries(chunk.map((id, i) => [`$id${i}`, id]));
        const rows = (0, database_1.dbAll)(`SELECT * FROM products WHERE _id IN (${chunk.map((_, i) => `$id${i}`).join(', ')})`, params);
        for (const row of rows)
            byId.set(String(row._id), row);
    }
    return ids.map((id) => byId.get(id)).filter((row) => Boolean(row));
}
function registerProductHandlers() {
    (0, licenseGuard_1.handleLicensed)('products:getAll', (_e, search) => {
        if (search?.trim())
            return loadInOrder(rankedIds(search.trim(), LIVE));
        return (0, database_1.dbAll)('SELECT * FROM products WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    // One page of the catalogue, in the same shape the server returns.
    (0, licenseGuard_1.handleLicensed)('products:getPage', (_e, query = {}) => {
        const page = Math.max(1, Math.floor(Number(query.page) || 1));
        const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(query.pageSize) || 25)));
        const search = query.search?.trim();
        const where = query.lowStock ? `${LIVE} AND stock <= ${analytics_1.LOW_STOCK_THRESHOLD}` : LIVE;
        const pageOf = (items, total) => ({ items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
        // A search lists the smart search's matches, best first.
        if (search) {
            const ids = rankedIds(search, where);
            return pageOf(loadInOrder(ids.slice((page - 1) * pageSize, page * pageSize)), ids.length);
        }
        const order = query.lowStock ? 'stock ASC, name ASC, _id ASC' : 'name ASC, _id ASC';
        const { total } = (0, database_1.dbGet)(`SELECT COUNT(*) AS total FROM products WHERE ${where}`);
        const items = (0, database_1.dbAll)(`SELECT * FROM products WHERE ${where} ORDER BY ${order} LIMIT $limit OFFSET $offset`, {
            $limit: pageSize,
            $offset: (page - 1) * pageSize,
        });
        return pageOf(items, total);
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