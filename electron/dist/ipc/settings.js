"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSettingsHandlers = registerSettingsHandlers;
const licenseGuard_1 = require("../license/licenseGuard");
const database_1 = require("../db/database");
/** SQLite keeps JSON as text and booleans as 0/1; hand the UI real values. */
function toSettings(row) {
    if (!row)
        return null;
    return {
        ...row,
        showRemarksPrompt: row.showRemarksPrompt !== 0,
        quickProducts: JSON.parse(row.quickProducts || '[]'),
    };
}
/**
 * The till's one settings record: the one with unsent edits if any, else the
 * newest. (A pull leaves exactly one; this also copes with older tills that
 * ended up with two.)
 */
const CURRENT_SETTINGS = `SELECT * FROM settings ORDER BY isSync ASC, updatedAt DESC LIMIT 1`;
/** The current record's id, creating a placeholder on first use. */
function ensureSettings() {
    const existing = (0, database_1.dbGet)(CURRENT_SETTINGS);
    if (existing)
        return existing._id;
    // A placeholder with defaults until the first pull brings the company's
    // record. It has nothing to send, so it is marked synced and a pull simply
    // replaces it.
    const _id = (0, database_1.generateLocalId)();
    const ts = (0, database_1.now)();
    (0, database_1.dbRun)(`INSERT INTO settings (_id, createdAt, updatedAt, isSync) VALUES ($id, $ts, $ts, 1)`, { $id: _id, $ts: ts });
    return _id;
}
function registerSettingsHandlers() {
    (0, licenseGuard_1.handleLicensed)('settings:get', () => {
        ensureSettings();
        return toSettings((0, database_1.dbGet)(CURRENT_SETTINGS));
    });
    (0, licenseGuard_1.handleLicensed)('settings:update', (_e, data) => {
        const id = ensureSettings();
        (0, database_1.dbRun)(`UPDATE settings SET
         shopName=$shopName, shopAddress=$shopAddress, shopPhone=$shopPhone,
         shopEmail=$shopEmail, shopWebsite=$shopWebsite, receiptFooter=$receiptFooter,
         receiptSize=$receiptSize, showRemarksPrompt=$showRemarksPrompt,
         loyaltyPointsPerEuro=$loyaltyPPE, loyaltyRewardThreshold=$loyaltyRT,
         loyaltyRewardValue=$loyaltyRV,
         quickProducts=COALESCE($quickProducts, quickProducts),
         updatedAt=$ts, isSync=0
       WHERE _id=$id`, {
            $shopName: (0, database_1.v)(data.shopName),
            $shopAddress: (0, database_1.v)(data.shopAddress),
            $shopPhone: (0, database_1.v)(data.shopPhone, ''),
            $shopEmail: (0, database_1.v)(data.shopEmail, ''),
            $shopWebsite: (0, database_1.v)(data.shopWebsite, ''),
            $receiptFooter: (0, database_1.v)(data.receiptFooter, ''),
            $receiptSize: data.receiptSize === 'A4' ? 'A4' : 'Thermal',
            $showRemarksPrompt: data.showRemarksPrompt === false ? 0 : 1,
            $loyaltyPPE: (0, database_1.v)(data.loyaltyPointsPerEuro, 1),
            $loyaltyRT: (0, database_1.v)(data.loyaltyRewardThreshold, 100),
            $loyaltyRV: (0, database_1.v)(data.loyaltyRewardValue, 5),
            // The settings form does not send quick products; keep them unless given.
            $quickProducts: Array.isArray(data.quickProducts) ? JSON.stringify(data.quickProducts) : null,
            $ts: (0, database_1.now)(),
            $id: id,
        });
        return toSettings((0, database_1.dbGet)('SELECT * FROM settings WHERE _id = $id', { $id: id }));
    });
    (0, licenseGuard_1.handleLicensed)('settings:getQuickProducts', () => {
        ensureSettings();
        const row = (0, database_1.dbGet)(CURRENT_SETTINGS);
        return JSON.parse(row?.quickProducts || '[]');
    });
    (0, licenseGuard_1.handleLicensed)('settings:updateQuickProducts', (_e, quickProducts) => {
        const id = ensureSettings();
        (0, database_1.dbRun)(`UPDATE settings SET quickProducts=$qp, updatedAt=$ts, isSync=0 WHERE _id=$id`, { $qp: JSON.stringify(quickProducts), $ts: (0, database_1.now)(), $id: id });
        return quickProducts;
    });
}
//# sourceMappingURL=settings.js.map