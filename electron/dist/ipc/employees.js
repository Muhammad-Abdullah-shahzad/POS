"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEmployeeHandlers = registerEmployeeHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerEmployeeHandlers() {
    electron_1.ipcMain.handle('employees:getAll', () => {
        return (0, database_1.dbAll)('SELECT * FROM employees WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    electron_1.ipcMain.handle('employees:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO employees (_id, name, contactNo, emailId, address, role, gender, dob, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $contactNo, $emailId, $address, $role, $gender, $dob, $createdAt, $updatedAt, 0)`, {
            $id: _id, $name: (0, database_1.v)(data.name), $contactNo: (0, database_1.v)(data.contactNo),
            $emailId: (0, database_1.v)(data.emailId), $address: (0, database_1.v)(data.address),
            $role: (0, database_1.v)(data.role), $gender: (0, database_1.v)(data.gender), $dob: (0, database_1.v)(data.dob),
            $createdAt: ts, $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM employees WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('employees:update', (_e, _id, data) => {
        (0, database_1.dbRun)(`UPDATE employees SET name=$name, contactNo=$contactNo, emailId=$emailId,
       address=$address, role=$role, gender=$gender, dob=$dob,
       updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`, {
            $id: _id, $name: (0, database_1.v)(data.name), $contactNo: (0, database_1.v)(data.contactNo),
            $emailId: (0, database_1.v)(data.emailId), $address: (0, database_1.v)(data.address),
            $role: (0, database_1.v)(data.role), $gender: (0, database_1.v)(data.gender), $dob: (0, database_1.v)(data.dob),
            $ts: (0, database_1.now)(),
        });
        return (0, database_1.dbGet)('SELECT * FROM employees WHERE _id = $id', { $id: _id });
    });
    electron_1.ipcMain.handle('employees:delete', (_e, _id) => {
        (0, database_1.softDelete)('employees', _id);
        return { success: true };
    });
}
//# sourceMappingURL=employees.js.map