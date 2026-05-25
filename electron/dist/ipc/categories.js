"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCategoryHandlers = registerCategoryHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerCategoryHandlers() {
    electron_1.ipcMain.handle('categories:getAll', () => {
        const rows = (0, database_1.dbAll)('SELECT * FROM categories WHERE deletedAt IS NULL ORDER BY name ASC');
        return rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') }));
    });
    electron_1.ipcMain.handle('categories:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO categories (_id, name, items, vatRate, vatType, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $items, $vatRate, $vatType, $createdAt, $updatedAt, 0)`, {
            $id: _id,
            $name: (0, database_1.v)(data.name),
            $items: JSON.stringify(data.items ?? []),
            $vatRate: (0, database_1.v)(data.vatRate, 0),
            $vatType: (0, database_1.v)(data.vatType, 'exclusive'),
            $createdAt: ts,
            $updatedAt: ts,
        });
        const row = (0, database_1.dbGet)('SELECT * FROM categories WHERE _id = $id', { $id: _id });
        return { ...row, items: JSON.parse(row?.items || '[]') };
    });
    electron_1.ipcMain.handle('categories:update', (_e, _id, data) => {
        (0, database_1.dbRun)(`UPDATE categories SET name=$name, items=$items, vatRate=$vatRate, vatType=$vatType,
       updatedAt=$ts, isSync=0 WHERE _id=$id`, {
            $id: _id,
            $name: (0, database_1.v)(data.name),
            $items: JSON.stringify(data.items ?? []),
            $vatRate: (0, database_1.v)(data.vatRate, 0),
            $vatType: (0, database_1.v)(data.vatType, 'exclusive'),
            $ts: (0, database_1.now)(),
        });
        const row = (0, database_1.dbGet)('SELECT * FROM categories WHERE _id = $id', { $id: _id });
        return { ...row, items: JSON.parse(row?.items || '[]') };
    });
    electron_1.ipcMain.handle('categories:delete', (_e, _id) => {
        (0, database_1.softDelete)('categories', _id);
        return { success: true };
    });
}
//# sourceMappingURL=categories.js.map