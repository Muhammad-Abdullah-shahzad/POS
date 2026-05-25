"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerExpenseHandlers = registerExpenseHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerExpenseHandlers() {
    electron_1.ipcMain.handle('expenses:getAll', () => {
        return (0, database_1.dbAll)('SELECT * FROM expenses ORDER BY date DESC');
    });
    electron_1.ipcMain.handle('expenses:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO expenses (_id, title, amount, category, date, paymentMethod, notes, attachmentUrl, createdAt, updatedAt, isSync)
       VALUES ($id, $title, $amount, $category, $date, $paymentMethod, $notes, $attachmentUrl, $createdAt, $updatedAt, 0)`, {
            $id: _id,
            $title: (0, database_1.v)(data.title),
            $amount: (0, database_1.v)(data.amount, 0),
            $category: (0, database_1.v)(data.category),
            $date: (0, database_1.v)(data.date, ts),
            $paymentMethod: (0, database_1.v)(data.paymentMethod),
            $notes: (0, database_1.v)(data.notes),
            $attachmentUrl: (0, database_1.v)(data.attachmentUrl),
            $createdAt: ts,
            $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM expenses WHERE _id = $id', { $id: _id });
    });
}
//# sourceMappingURL=expenses.js.map