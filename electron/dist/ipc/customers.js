"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerHandlers = registerCustomerHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerCustomerHandlers() {
    electron_1.ipcMain.handle('customers:getAll', () => {
        return (0, database_1.dbAll)('SELECT * FROM customers WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    electron_1.ipcMain.handle('customers:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO customers
         (_id, name, contactNum1, contactNum2, email, address, eircode,
          qrCode, barcode, birthday, anniversary, timesVisited, totalAmount,
          lastVisit, loyaltyPoints, createdAt, updatedAt, isSync)
       VALUES
         ($id, $name, $c1, $c2, $email, $address, $eircode,
          $qrCode, $barcode, $birthday, $anniversary, $timesVisited, $totalAmount,
          $lastVisit, $loyaltyPoints, $createdAt, $updatedAt, 0)`, {
            $id: _id, $name: (0, database_1.v)(data.name), $c1: (0, database_1.v)(data.contactNum1),
            $c2: (0, database_1.v)(data.contactNum2, ''), $email: (0, database_1.v)(data.email, ''),
            $address: (0, database_1.v)(data.address, ''), $eircode: (0, database_1.v)(data.eircode, ''),
            $qrCode: (0, database_1.v)(data.qrCode, ''), $barcode: (0, database_1.v)(data.barcode, ''),
            $birthday: (0, database_1.v)(data.birthday), $anniversary: (0, database_1.v)(data.anniversary),
            $timesVisited: (0, database_1.v)(data.timesVisited, 0), $totalAmount: (0, database_1.v)(data.totalAmount, 0),
            $lastVisit: (0, database_1.v)(data.lastVisit, ''), $loyaltyPoints: (0, database_1.v)(data.loyaltyPoints, 0),
            $createdAt: ts, $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('customers:update', (_e, _id, data) => {
        (0, database_1.dbRun)(`UPDATE customers SET
         name=$name, contactNum1=$c1, contactNum2=$c2, email=$email,
         address=$address, eircode=$eircode, qrCode=$qrCode, barcode=$barcode,
         birthday=$birthday, anniversary=$anniversary, timesVisited=$timesVisited,
         totalAmount=$totalAmount, lastVisit=$lastVisit, loyaltyPoints=$loyaltyPoints,
         updatedAt=$ts, isSync=0
       WHERE _id=$id AND deletedAt IS NULL`, {
            $id: _id, $name: (0, database_1.v)(data.name), $c1: (0, database_1.v)(data.contactNum1),
            $c2: (0, database_1.v)(data.contactNum2, ''), $email: (0, database_1.v)(data.email, ''),
            $address: (0, database_1.v)(data.address, ''), $eircode: (0, database_1.v)(data.eircode, ''),
            $qrCode: (0, database_1.v)(data.qrCode, ''), $barcode: (0, database_1.v)(data.barcode, ''),
            $birthday: (0, database_1.v)(data.birthday), $anniversary: (0, database_1.v)(data.anniversary),
            $timesVisited: (0, database_1.v)(data.timesVisited, 0), $totalAmount: (0, database_1.v)(data.totalAmount, 0),
            $lastVisit: (0, database_1.v)(data.lastVisit, ''), $loyaltyPoints: (0, database_1.v)(data.loyaltyPoints, 0),
            $ts: (0, database_1.now)(),
        });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('customers:delete', (_e, _id) => {
        (0, database_1.softDelete)('customers', _id);
        return { success: true };
    });
    electron_1.ipcMain.handle('customers:updateStats', (_e, _id, amount) => {
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`UPDATE customers SET timesVisited = timesVisited + 1, totalAmount = totalAmount + $amount,
         lastVisit=$ts, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`, { $id: _id, $amount: amount, $ts: ts });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('customers:resetPoints', (_e, _id) => {
        (0, database_1.dbRun)(`UPDATE customers SET loyaltyPoints=0, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`, { $id: _id, $ts: (0, database_1.now)() });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
}
//# sourceMappingURL=customers.js.map