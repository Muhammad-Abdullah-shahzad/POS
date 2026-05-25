"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSettingsHandlers = registerSettingsHandlers;
const electron_1 = require("electron");
const database_1 = require("../db/database");
function registerSettingsHandlers() {
    const ensureSettings = () => {
        const existing = (0, database_1.dbGet)('SELECT _id FROM settings LIMIT 1');
        if (!existing) {
            const _id = (0, database_1.generateLocalId)();
            const ts = (0, database_1.now)();
            (0, database_1.dbRun)(`INSERT INTO settings (_id, createdAt, updatedAt, isSync) VALUES ($id, $ts, $ts, 0)`, { $id: _id, $ts: ts });
        }
    };
    electron_1.ipcMain.handle('settings:get', () => {
        ensureSettings();
        const row = (0, database_1.dbGet)('SELECT * FROM settings LIMIT 1');
        if (!row)
            return null;
        return { ...row, quickProducts: JSON.parse(row.quickProducts || '[]') };
    });
    electron_1.ipcMain.handle('settings:update', (_e, data) => {
        ensureSettings();
        (0, database_1.dbRun)(`UPDATE settings SET
         shopName=$shopName, shopAddress=$shopAddress, shopPhone=$shopPhone,
         shopEmail=$shopEmail, shopWebsite=$shopWebsite, receiptFooter=$receiptFooter,
         defaultVatRate=$defaultVatRate, isVatInclusiveDefault=$isVatInclusive,
         loyaltyPointsPerEuro=$loyaltyPPE, loyaltyRewardThreshold=$loyaltyRT,
         loyaltyRewardValue=$loyaltyRV, quickProducts=$quickProducts,
         updatedAt=$ts, isSync=0`, {
            $shopName: (0, database_1.v)(data.shopName),
            $shopAddress: (0, database_1.v)(data.shopAddress),
            $shopPhone: (0, database_1.v)(data.shopPhone, ''),
            $shopEmail: (0, database_1.v)(data.shopEmail, ''),
            $shopWebsite: (0, database_1.v)(data.shopWebsite, ''),
            $receiptFooter: (0, database_1.v)(data.receiptFooter, ''),
            $defaultVatRate: (0, database_1.v)(data.defaultVatRate, 20),
            $isVatInclusive: data.isVatInclusiveDefault ? 1 : 0,
            $loyaltyPPE: (0, database_1.v)(data.loyaltyPointsPerEuro, 1),
            $loyaltyRT: (0, database_1.v)(data.loyaltyRewardThreshold, 100),
            $loyaltyRV: (0, database_1.v)(data.loyaltyRewardValue, 5),
            $quickProducts: JSON.stringify(data.quickProducts ?? []),
            $ts: (0, database_1.now)(),
        });
        const row = (0, database_1.dbGet)('SELECT * FROM settings LIMIT 1');
        return { ...row, quickProducts: JSON.parse(row?.quickProducts || '[]') };
    });
    electron_1.ipcMain.handle('settings:getQuickProducts', () => {
        ensureSettings();
        const row = (0, database_1.dbGet)('SELECT quickProducts FROM settings LIMIT 1');
        return JSON.parse(row?.quickProducts || '[]');
    });
    electron_1.ipcMain.handle('settings:updateQuickProducts', (_e, quickProducts) => {
        ensureSettings();
        (0, database_1.dbRun)(`UPDATE settings SET quickProducts=$qp, updatedAt=$ts, isSync=0`, { $qp: JSON.stringify(quickProducts), $ts: (0, database_1.now)() });
        return quickProducts;
    });
}
//# sourceMappingURL=settings.js.map