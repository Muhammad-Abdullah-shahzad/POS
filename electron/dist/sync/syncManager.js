"use strict";
/**
 * syncManager.ts
 * Syncs local SQLite → remote MongoDB.
 * Also syncs soft-deletes: sends pending_deletes to /sync/delete on the server.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSyncHandlers = registerSyncHandlers;
const electron_1 = require("electron");
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../db/database");
// ─────────────────────────────────────────────────────────────────────────────
function buildClient(config) {
    return axios_1.default.create({
        baseURL: config.baseUrl,
        headers: { Authorization: `Bearer ${config.token}` },
        timeout: 30000,
    });
}
// ── Upsert sync ───────────────────────────────────────────────────────────────
async function syncTable(table, endpoint, client, transform) {
    const result = { collection: table, synced: 0, errors: [] };
    try {
        // Only sync rows that are NOT soft-deleted (deletedAt IS NULL) and not yet synced
        const rows = (0, database_1.dbAll)(`SELECT * FROM ${table} WHERE isSync = 0 AND (deletedAt IS NULL OR deletedAt = '')`);
        if (rows.length > 0) {
            const payload = transform ? rows.map(transform) : rows;
            await client.post(endpoint, payload);
            for (const row of rows) {
                if (row._id)
                    (0, database_1.dbRun)(`UPDATE ${table} SET isSync = 1 WHERE _id = $id`, { $id: row._id });
            }
            result.synced = rows.length;
        }
    }
    catch (err) {
        result.errors.push(err?.response?.data?.message || err.message || 'Unknown error');
    }
    return result;
}
// ── Delete sync ───────────────────────────────────────────────────────────────
// Maps SQLite table names → MongoDB collection endpoint prefix
const TABLE_TO_ENDPOINT = {
    products: 'products',
    categories: 'categories',
    orders: 'orders',
    customers: 'customers',
    employees: 'employees',
    expenses: 'expenses',
    suppliers: 'suppliers',
    bank_names: 'banks/names',
    bank_accounts: 'banks/accounts',
    bank_cards: 'banks/cards',
};
async function syncDeletes(client) {
    const result = { collection: 'deletes', synced: 0, errors: [] };
    try {
        const pending = (0, database_1.dbAll)(`SELECT * FROM pending_deletes WHERE isSync = 0`);
        if (pending.length === 0)
            return result;
        // Group by table
        const grouped = {};
        for (const row of pending) {
            const table = row.tableName;
            if (!grouped[table])
                grouped[table] = [];
            grouped[table].push(row.localId);
        }
        for (const [table, ids] of Object.entries(grouped)) {
            const endpoint = TABLE_TO_ENDPOINT[table];
            if (!endpoint)
                continue;
            try {
                await client.post(`/${endpoint}/sync/delete`, { ids });
                // Mark as synced
                for (const id of ids) {
                    (0, database_1.dbRun)(`UPDATE pending_deletes SET isSync = 1 WHERE tableName = $t AND localId = $id`, { $t: table, $id: id });
                }
                result.synced += ids.length;
            }
            catch (err) {
                result.errors.push(`${table}: ${err?.response?.data?.message || err.message}`);
            }
        }
    }
    catch (err) {
        result.errors.push(err.message);
    }
    return result;
}
// ── Collection definitions ────────────────────────────────────────────────────
const parseJson = (field) => (row) => ({
    ...row,
    [field]: JSON.parse(row[field] || '[]'),
});
const syncFunctions = [
    { table: 'products', endpoint: '/products/sync' },
    { table: 'categories', endpoint: '/categories/sync', transform: parseJson('items') },
    { table: 'orders', endpoint: '/orders/sync', transform: parseJson('items') },
    { table: 'customers', endpoint: '/customers/sync' },
    { table: 'employees', endpoint: '/employees/sync' },
    { table: 'expenses', endpoint: '/expenses/sync' },
    { table: 'suppliers', endpoint: '/suppliers/sync' },
    { table: 'bank_names', endpoint: '/banks/names/sync' },
    { table: 'bank_accounts', endpoint: '/banks/accounts/sync' },
    { table: 'bank_cards', endpoint: '/banks/cards/sync' },
    { table: 'settings', endpoint: '/settings/sync', transform: parseJson('quickProducts') },
];
// ── Master sync ───────────────────────────────────────────────────────────────
async function syncAll(config) {
    const client = buildClient(config);
    const settled = await Promise.allSettled([
        ...syncFunctions.map(({ table, endpoint, transform }) => syncTable(table, endpoint, client, transform)),
        syncDeletes(client),
    ]);
    const results = settled.map((r, i) => {
        const name = i < syncFunctions.length ? syncFunctions[i].table : 'deletes';
        if (r.status === 'fulfilled')
            return r.value;
        return { collection: name, synced: 0, errors: [r.reason?.message || 'Failed'] };
    });
    const totalSynced = results.reduce((s, r) => s + r.synced, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    return { success: totalErrors === 0, results, totalSynced, totalErrors };
}
// ── IPC ───────────────────────────────────────────────────────────────────────
function registerSyncHandlers() {
    electron_1.ipcMain.handle('sync:all', async (_e, config) => {
        console.log('[Sync] Starting full sync to', config.baseUrl);
        const result = await syncAll(config);
        console.log('[Sync] Done:', result.totalSynced, 'synced,', result.totalErrors, 'errors');
        return result;
    });
    electron_1.ipcMain.handle('sync:collection', async (_e, config, collection) => {
        const client = buildClient(config);
        if (collection === 'deletes')
            return syncDeletes(client);
        const def = syncFunctions.find((f) => f.table === collection);
        if (!def)
            return { collection, synced: 0, errors: [`Unknown collection: ${collection}`] };
        return syncTable(def.table, def.endpoint, client, def.transform);
    });
    electron_1.ipcMain.handle('sync:pendingCounts', () => {
        const counts = {};
        for (const { table } of syncFunctions) {
            const rows = (0, database_1.dbAll)(`SELECT COUNT(*) as cnt FROM ${table} WHERE isSync = 0 AND (deletedAt IS NULL OR deletedAt = '')`);
            counts[table] = rows[0]?.cnt ?? 0;
        }
        const delRows = (0, database_1.dbAll)(`SELECT COUNT(*) as cnt FROM pending_deletes WHERE isSync = 0`);
        counts['deletes'] = delRows[0]?.cnt ?? 0;
        return counts;
    });
}
//# sourceMappingURL=syncManager.js.map