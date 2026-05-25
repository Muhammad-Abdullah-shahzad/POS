"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBankHandlers = registerBankHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerBankHandlers() {
    // ── BANK NAMES ────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('banks:getNames', () => {
        return (0, database_1.dbAll)('SELECT * FROM bank_names WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    electron_1.ipcMain.handle('banks:addName', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO bank_names (_id, name, createdAt, updatedAt, isSync)
       VALUES ($id, $name, $createdAt, $updatedAt, 0)`, { $id: _id, $name: (0, database_1.v)(data.name), $createdAt: ts, $updatedAt: ts });
        return (0, database_1.dbGet)('SELECT * FROM bank_names WHERE _id = $id', { $id: _id });
    });
    // ── BANK ACCOUNTS ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('banks:getAccounts', () => {
        return (0, database_1.dbAll)('SELECT * FROM bank_accounts WHERE deletedAt IS NULL ORDER BY accountName ASC');
    });
    electron_1.ipcMain.handle('banks:addAccount', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO bank_accounts (_id, bankName, type, accountName, iban, bic, createdAt, updatedAt, isSync)
       VALUES ($id, $bankName, $type, $accountName, $iban, $bic, $createdAt, $updatedAt, 0)`, {
            $id: _id,
            $bankName: (0, database_1.v)(data.bankName),
            $type: (0, database_1.v)(data.type),
            $accountName: (0, database_1.v)(data.accountName),
            $iban: (0, database_1.v)(data.iban),
            $bic: (0, database_1.v)(data.bic),
            $createdAt: ts,
            $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM bank_accounts WHERE _id = $id', { $id: _id });
    });
    // ── BANK CARDS ────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('banks:getCards', () => {
        return (0, database_1.dbAll)('SELECT * FROM bank_cards WHERE deletedAt IS NULL ORDER BY cardName ASC');
    });
    electron_1.ipcMain.handle('banks:addCard', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO bank_cards (_id, bankName, accountName, type, cardNumber, cardName, expiryDate, createdAt, updatedAt, isSync)
       VALUES ($id, $bankName, $accountName, $type, $cardNumber, $cardName, $expiryDate, $createdAt, $updatedAt, 0)`, {
            $id: _id,
            $bankName: (0, database_1.v)(data.bankName),
            $accountName: (0, database_1.v)(data.accountName),
            $type: (0, database_1.v)(data.type),
            $cardNumber: (0, database_1.v)(data.cardNumber),
            $cardName: (0, database_1.v)(data.cardName),
            $expiryDate: (0, database_1.v)(data.expiryDate),
            $createdAt: ts,
            $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM bank_cards WHERE _id = $id', { $id: _id });
    });
}
//# sourceMappingURL=banks.js.map