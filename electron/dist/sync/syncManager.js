"use strict";
/**
 * syncManager.ts
 *
 * TWO-WAY sync between local SQLite (Electron) and remote MongoDB (web server).
 *
 * PUSH  (local → server): Uploads all rows where isSync = 0.
 * PULL  (server → local): Downloads all rows from the server and upserts them
 *   locally, with the following conflict rule:
 *     - isSync = 0  → local has pending changes; skip (push will send it later)
 *     - isSync = 1  → already clean; overwrite with server version
 *     - missing locally → insert from server
 *     - in SQLite but gone from server → delete locally (web user deleted it)
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
// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
/** Coerce any value coming from JSON into a type sql.js accepts. */
function toSqlValue(val) {
    if (val === undefined || val === null)
        return null;
    if (typeof val === 'string')
        return val;
    if (typeof val === 'number')
        return val;
    if (typeof val === 'boolean')
        return val ? 1 : 0;
    if (val instanceof Uint8Array)
        return val;
    return JSON.stringify(val); // objects / arrays
}
/** Return the column names for a table (excluding the auto-increment localId). */
function getColumns(table) {
    const rows = (0, database_1.dbAll)(`PRAGMA table_info(${table})`);
    return rows.map((r) => r.name).filter((n) => n !== 'localId');
}
// ── PUSH: local → server ──────────────────────────────────────────────────────
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
    expense_categories: 'expense-categories',
    employee_damages: 'employee-damages',
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
const stringifyField = (field) => (row) => ({
    ...row,
    [field]: Array.isArray(row[field])
        ? JSON.stringify(row[field])
        : typeof row[field] === 'object' && row[field] !== null
            ? JSON.stringify(row[field])
            : (row[field] ?? '[]'),
});
async function pullTable(table, fetchEndpoint, client, serialize) {
    const result = { collection: `pull:${table}`, synced: 0, errors: [] };
    try {
        const res = await client.get(fetchEndpoint);
        let serverRows = res.data?.data ?? [];
        // Settings endpoint returns a single object, not an array
        if (!Array.isArray(serverRows))
            serverRows = serverRows ? [serverRows] : [];
        if (serverRows.length === 0)
            return result;
        // Column list for this table (from SQLite schema)
        const columns = getColumns(table);
        // Build a map: _id → isSync for every local row
        const localRows = (0, database_1.dbAll)(`SELECT _id, isSync FROM ${table}`);
        const localSyncMap = new Map(localRows.map((r) => [r._id, r.isSync]));
        const serverIdSet = new Set();
        for (const rawRow of serverRows) {
            const _id = String(rawRow._id ?? '');
            if (!_id)
                continue;
            serverIdSet.add(_id);
            const localIsSync = localSyncMap.get(_id);
            // Local has unsent changes — don't overwrite, push will handle it
            if (localIsSync === 0)
                continue;
            const row = serialize ? serialize(rawRow) : rawRow;
            // Only write columns that exist in SQLite; force isSync = 1
            const cols = columns.filter((c) => c === 'isSync' || c in row);
            const colList = cols.join(', ');
            const paramStr = cols.map((c) => `$${c}`).join(', ');
            const params = {};
            for (const col of cols) {
                params[`$${col}`] = col === 'isSync' ? 1 : toSqlValue(row[col]);
            }
            (0, database_1.dbRun)(`INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${paramStr})`, params);
            result.synced++;
        }
        // Delete local rows (isSync=1) that the server no longer has → deleted on web
        for (const [_id, isSync] of localSyncMap) {
            if (isSync === 1 && !serverIdSet.has(_id)) {
                (0, database_1.dbRun)(`DELETE FROM ${table} WHERE _id = $id`, { $id: _id });
            }
        }
    }
    catch (err) {
        result.errors.push(err?.response?.data?.message || err.message || 'Unknown error');
    }
    return result;
}
// ── Collection definitions ────────────────────────────────────────────────────
const parseJson = (field) => (row) => ({
    ...row,
    [field]: JSON.parse(row[field] || '[]'),
});
// ── PUSH collection definitions ───────────────────────────────────────────────
const syncFunctions = [
    { table: 'products', endpoint: '/products/sync' },
    { table: 'categories', endpoint: '/categories/sync', transform: parseJson('items') },
    { table: 'orders', endpoint: '/orders/sync', transform: parseJson('items') },
    { table: 'customers', endpoint: '/customers/sync' },
    { table: 'employees', endpoint: '/employees/sync' },
    { table: 'expenses', endpoint: '/expenses/sync' },
    { table: 'expense_categories', endpoint: '/expense-categories/sync' },
    { table: 'employee_damages', endpoint: '/employee-damages/sync' },
    { table: 'suppliers', endpoint: '/suppliers/sync' },
    { table: 'bank_names', endpoint: '/banks/names/sync' },
    { table: 'bank_accounts', endpoint: '/banks/accounts/sync' },
    { table: 'bank_cards', endpoint: '/banks/cards/sync' },
    { table: 'settings', endpoint: '/settings/sync', transform: parseJson('quickProducts') },
];
// ── PULL collection definitions ───────────────────────────────────────────────
const pullFunctions = [
    { table: 'products', fetchEndpoint: '/products' },
    { table: 'categories', fetchEndpoint: '/categories', serialize: stringifyField('items') },
    { table: 'orders', fetchEndpoint: '/orders', serialize: stringifyField('items') },
    { table: 'customers', fetchEndpoint: '/customers' },
    { table: 'employees', fetchEndpoint: '/employees' },
    { table: 'expenses', fetchEndpoint: '/expenses' },
    { table: 'expense_categories', fetchEndpoint: '/expense-categories' },
    { table: 'employee_damages', fetchEndpoint: '/employee-damages' },
    { table: 'suppliers', fetchEndpoint: '/suppliers' },
    { table: 'bank_names', fetchEndpoint: '/banks/names' },
    { table: 'bank_accounts', fetchEndpoint: '/banks/accounts' },
    { table: 'bank_cards', fetchEndpoint: '/banks/cards' },
    { table: 'settings', fetchEndpoint: '/settings', serialize: stringifyField('quickProducts') },
];
// ── Master sync (push → pull) ─────────────────────────────────────────────────
async function syncAll(config) {
    const client = buildClient(config);
    // ① Push: send local changes to the server first so the server has the latest data
    const pushSettled = await Promise.allSettled([
        ...syncFunctions.map(({ table, endpoint, transform }) => syncTable(table, endpoint, client, transform)),
        syncDeletes(client),
    ]);
    const pushResults = pushSettled.map((r, i) => {
        const name = i < syncFunctions.length ? syncFunctions[i].table : 'deletes';
        if (r.status === 'fulfilled')
            return r.value;
        return { collection: name, synced: 0, errors: [r.reason?.message || 'Push failed'] };
    });
    // ② Pull: fetch all server data and upsert locally
    const pullSettled = await Promise.allSettled(pullFunctions.map(({ table, fetchEndpoint, serialize }) => pullTable(table, fetchEndpoint, client, serialize)));
    const pullResults = pullSettled.map((r, i) => {
        const name = `pull:${pullFunctions[i].table}`;
        if (r.status === 'fulfilled')
            return { ...r.value, collection: name };
        return { collection: name, synced: 0, errors: [r.reason?.message || 'Pull failed'] };
    });
    const results = [...pushResults, ...pullResults];
    const totalSynced = results.reduce((s, r) => s + r.synced, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    return { success: totalErrors === 0, results, totalSynced, totalErrors };
}
async function pullAll(config) {
    const client = buildClient(config);
    const settled = await Promise.allSettled(pullFunctions.map(({ table, fetchEndpoint, serialize }) => pullTable(table, fetchEndpoint, client, serialize)));
    const results = settled.map((r, i) => {
        const name = `pull:${pullFunctions[i].table}`;
        if (r.status === 'fulfilled')
            return { ...r.value, collection: name };
        return { collection: name, synced: 0, errors: [r.reason?.message || 'Pull failed'] };
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
    electron_1.ipcMain.handle('sync:pull', async (_e, config) => {
        console.log('[Sync] Starting pull from', config.baseUrl);
        const result = await pullAll(config);
        console.log('[Sync] Pull done:', result.totalSynced, 'pulled,', result.totalErrors, 'errors');
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