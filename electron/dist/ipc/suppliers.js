"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSupplierHandlers = registerSupplierHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerSupplierHandlers() {
    electron_1.ipcMain.handle('suppliers:getAll', () => {
        return (0, database_1.dbAll)('SELECT * FROM suppliers WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    electron_1.ipcMain.handle('suppliers:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO suppliers (_id, name, contact, emailId, address, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $contact, $emailId, $address, $createdAt, $updatedAt, 0)`, {
            $id: _id,
            $name: (0, database_1.v)(data.name),
            $contact: (0, database_1.v)(data.contact),
            $emailId: (0, database_1.v)(data.emailId),
            $address: (0, database_1.v)(data.address),
            $createdAt: ts,
            $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM suppliers WHERE _id = $id', { $id: _id });
    });
}
//# sourceMappingURL=suppliers.js.map