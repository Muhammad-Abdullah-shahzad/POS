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

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import axios, { AxiosInstance } from 'axios';
import { dbAll, dbRun } from '../db/database';
import type { SqlValue } from 'sql.js';

export interface SyncConfig { baseUrl: string; token: string; }

interface SyncResult { collection: string; synced: number; errors: string[]; }

// ─────────────────────────────────────────────────────────────────────────────

function buildClient(config: SyncConfig): AxiosInstance {
  return axios.create({
    baseURL: config.baseUrl,
    headers: { Authorization: `Bearer ${config.token}` },
    timeout: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Coerce any value coming from JSON into a type sql.js accepts. */
function toSqlValue(val: unknown): SqlValue {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Uint8Array) return val;
  return JSON.stringify(val); // objects / arrays
}

/** Return the column names for a table (excluding the auto-increment localId). */
function getColumns(table: string): string[] {
  const rows = dbAll(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name as string).filter((n) => n !== 'localId');
}

// ── PUSH: local → server ──────────────────────────────────────────────────────

async function syncTable(
  table: string,
  endpoint: string,
  client: AxiosInstance,
  transform?: (row: Record<string, unknown>) => Record<string, unknown>
): Promise<SyncResult> {
  const result: SyncResult = { collection: table, synced: 0, errors: [] };
  try {
    // Only sync rows that are NOT soft-deleted (deletedAt IS NULL) and not yet synced
    const rows = dbAll(
      `SELECT * FROM ${table} WHERE isSync = 0 AND (deletedAt IS NULL OR deletedAt = '')`
    );
    if (rows.length > 0) {
      const payload = transform ? rows.map(transform) : rows;
      await client.post(endpoint, payload);
      for (const row of rows) {
        if (row._id) dbRun(`UPDATE ${table} SET isSync = 1 WHERE _id = $id`, { $id: row._id as string });
      }
      result.synced = rows.length;
    }
  } catch (err: any) {
    const msg = typeof err?.response?.data?.data === 'string'
      ? err.response.data.data
      : (err?.response?.data?.message || err.message || 'Unknown error');
    result.errors.push(msg);
  }
  return result;
}

// ── Delete sync ───────────────────────────────────────────────────────────────

// Maps SQLite table names → MongoDB collection endpoint prefix
const TABLE_TO_ENDPOINT: Record<string, string> = {
  products:      'products',
  categories:    'categories',
  orders:        'orders',
  customers:     'customers',
  employees:     'employees',
  expenses:           'expenses',
  expense_categories: 'expense-categories',
  employee_damages:   'employee-damages',
  suppliers:          'suppliers',
  bank_names:    'banks/names',
  bank_accounts: 'banks/accounts',
  bank_cards:    'banks/cards',
};

async function syncDeletes(client: AxiosInstance): Promise<SyncResult> {
  const result: SyncResult = { collection: 'deletes', synced: 0, errors: [] };
  try {
    const pending = dbAll(`SELECT * FROM pending_deletes WHERE isSync = 0`);
    if (pending.length === 0) return result;

    // Group by table
    const grouped: Record<string, string[]> = {};
    for (const row of pending) {
      const table = row.tableName as string;
      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(row.localId as string);
    }

    for (const [table, ids] of Object.entries(grouped)) {
      const endpoint = TABLE_TO_ENDPOINT[table];
      if (!endpoint) continue;
      try {
        await client.post(`/${endpoint}/sync/delete`, { ids });
        // Mark as synced
        for (const id of ids) {
          dbRun(
            `UPDATE pending_deletes SET isSync = 1 WHERE tableName = $t AND localId = $id`,
            { $t: table, $id: id }
          );
        }
        result.synced += ids.length;
      } catch (err: any) {
        result.errors.push(`${table}: ${err?.response?.data?.message || err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(err.message);
  }
  return result;
}

// ── PULL: server → local ──────────────────────────────────────────────────────

/**
 * Serialize a server row before writing to SQLite.
 * Arrays / objects that live in a JSON column must be stringified.
 */
type RowSerializer = (row: Record<string, unknown>) => Record<string, unknown>;

const stringifyField =
  (field: string): RowSerializer =>
  (row) => ({
    ...row,
    [field]: Array.isArray(row[field])
      ? JSON.stringify(row[field])
      : typeof row[field] === 'object' && row[field] !== null
      ? JSON.stringify(row[field])
      : (row[field] ?? '[]'),
  });

async function pullTable(
  table: string,
  fetchEndpoint: string,
  client: AxiosInstance,
  serialize?: RowSerializer
): Promise<SyncResult> {
  const result: SyncResult = { collection: `pull:${table}`, synced: 0, errors: [] };
  try {
    const res = await client.get(fetchEndpoint);
    let serverRows: Record<string, unknown>[] = res.data?.data ?? [];

    // Settings endpoint returns a single object, not an array
    if (!Array.isArray(serverRows)) serverRows = serverRows ? [serverRows] : [];
    if (serverRows.length === 0) return result;

    // Column list for this table (from SQLite schema)
    const columns = getColumns(table);

    // Build a map: _id → isSync for every local row
    const localRows = dbAll(`SELECT _id, isSync FROM ${table}`);
    const localSyncMap = new Map<string, number>(
      localRows.map((r) => [r._id as string, r.isSync as number])
    );
    const serverIdSet = new Set<string>();

    for (const rawRow of serverRows) {
      const _id = String(rawRow._id ?? '');
      if (!_id) continue;
      serverIdSet.add(_id);

      const localIsSync = localSyncMap.get(_id);

      // Local has unsent changes — don't overwrite, push will handle it
      if (localIsSync === 0) continue;

      const row = serialize ? serialize(rawRow) : rawRow;

      // Only write columns that exist in SQLite; force isSync = 1
      const cols = columns.filter((c) => c === 'isSync' || c in row);
      const colList  = cols.join(', ');
      const paramStr = cols.map((c) => `$${c}`).join(', ');

      const params: Record<string, SqlValue> = {};
      for (const col of cols) {
        params[`$${col}`] = col === 'isSync' ? 1 : toSqlValue(row[col]);
      }

      dbRun(
        `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${paramStr})`,
        params
      );
      result.synced++;
    }

    // Delete local rows (isSync=1) that the server no longer has → deleted on web
    for (const [_id, isSync] of localSyncMap) {
      if (isSync === 1 && !serverIdSet.has(_id)) {
        dbRun(`DELETE FROM ${table} WHERE _id = $id`, { $id: _id });
      }
    }
  } catch (err: any) {
    const msg = typeof err?.response?.data?.data === 'string'
      ? err.response.data.data
      : (err?.response?.data?.message || err.message || 'Unknown error');
    result.errors.push(msg);
  }
  return result;
}

// ── Collection definitions ────────────────────────────────────────────────────

const parseJson = (field: string) => (row: Record<string, unknown>) => ({
  ...row,
  [field]: JSON.parse((row[field] as string) || '[]'),
});

// ── PUSH collection definitions ───────────────────────────────────────────────
const syncFunctions: Array<{
  table: string;
  endpoint: string;
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
}> = [
  { table: 'products',            endpoint: '/products/sync' },
  { table: 'categories',          endpoint: '/categories/sync',         transform: parseJson('items') },
  { table: 'orders',              endpoint: '/orders/sync',             transform: parseJson('items') },
  { table: 'customers',           endpoint: '/customers/sync' },
  { table: 'employees',           endpoint: '/employees/sync' },
  { table: 'expenses',            endpoint: '/expenses/sync' },
  { table: 'expense_categories',  endpoint: '/expense-categories/sync' },
  { table: 'employee_damages',    endpoint: '/employee-damages/sync' },
  { table: 'suppliers',           endpoint: '/suppliers/sync' },
  { table: 'bank_names',          endpoint: '/banks/names/sync' },
  { table: 'bank_accounts',       endpoint: '/banks/accounts/sync' },
  { table: 'bank_cards',          endpoint: '/banks/cards/sync' },
  { table: 'settings',            endpoint: '/settings/sync',           transform: parseJson('quickProducts') },
];

// ── PULL collection definitions ───────────────────────────────────────────────
const pullFunctions: Array<{
  table: string;
  fetchEndpoint: string;
  serialize?: RowSerializer;
}> = [
  { table: 'products',            fetchEndpoint: '/products' },
  { table: 'categories',          fetchEndpoint: '/categories',         serialize: stringifyField('items') },
  { table: 'orders',              fetchEndpoint: '/orders',             serialize: stringifyField('items') },
  { table: 'customers',           fetchEndpoint: '/customers' },
  { table: 'employees',           fetchEndpoint: '/employees' },
  { table: 'expenses',            fetchEndpoint: '/expenses' },
  { table: 'expense_categories',  fetchEndpoint: '/expense-categories' },
  { table: 'employee_damages',    fetchEndpoint: '/employee-damages' },
  { table: 'suppliers',           fetchEndpoint: '/suppliers' },
  { table: 'bank_names',          fetchEndpoint: '/banks/names' },
  { table: 'bank_accounts',       fetchEndpoint: '/banks/accounts' },
  { table: 'bank_cards',          fetchEndpoint: '/banks/cards' },
  { table: 'settings',            fetchEndpoint: '/settings',           serialize: stringifyField('quickProducts') },
];

// ── Master sync (push → pull) ─────────────────────────────────────────────────

async function syncAll(config: SyncConfig) {
  const client = buildClient(config);

  // ① Push: send local changes to the server first so the server has the latest data
  const pushSettled = await Promise.allSettled([
    ...syncFunctions.map(({ table, endpoint, transform }) =>
      syncTable(table, endpoint, client, transform)
    ),
    syncDeletes(client),
  ]);

  const pushResults: SyncResult[] = pushSettled.map((r, i) => {
    const name = i < syncFunctions.length ? syncFunctions[i].table : 'deletes';
    if (r.status === 'fulfilled') return r.value;
    return { collection: name, synced: 0, errors: [r.reason?.message || 'Push failed'] };
  });

  // ② Pull: fetch all server data and upsert locally
  const pullSettled = await Promise.allSettled(
    pullFunctions.map(({ table, fetchEndpoint, serialize }) =>
      pullTable(table, fetchEndpoint, client, serialize)
    )
  );

  const pullResults: SyncResult[] = pullSettled.map((r, i) => {
    const name = `pull:${pullFunctions[i].table}`;
    if (r.status === 'fulfilled') return { ...r.value, collection: name };
    return { collection: name, synced: 0, errors: [r.reason?.message || 'Pull failed'] };
  });

  const results = [...pushResults, ...pullResults];
  const totalSynced = results.reduce((s, r) => s + r.synced, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  return { success: totalErrors === 0, results, totalSynced, totalErrors };
}

async function pullAll(config: SyncConfig) {
  const client = buildClient(config);
  const settled = await Promise.allSettled(
    pullFunctions.map(({ table, fetchEndpoint, serialize }) =>
      pullTable(table, fetchEndpoint, client, serialize)
    )
  );
  const results: SyncResult[] = settled.map((r, i) => {
    const name = `pull:${pullFunctions[i].table}`;
    if (r.status === 'fulfilled') return { ...r.value, collection: name };
    return { collection: name, synced: 0, errors: [r.reason?.message || 'Pull failed'] };
  });
  const totalSynced = results.reduce((s, r) => s + r.synced, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  return { success: totalErrors === 0, results, totalSynced, totalErrors };
}

// ── IPC ───────────────────────────────────────────────────────────────────────

export function registerSyncHandlers(): void {
  ipcMain.handle('sync:all', async (_e: IpcMainInvokeEvent, config: SyncConfig) => {
    console.log('[Sync] Starting full sync to', config.baseUrl);
    const result = await syncAll(config);
    console.log('[Sync] Done:', result.totalSynced, 'synced,', result.totalErrors, 'errors');
    return result;
  });

  ipcMain.handle('sync:pull', async (_e: IpcMainInvokeEvent, config: SyncConfig) => {
    console.log('[Sync] Starting pull from', config.baseUrl);
    const result = await pullAll(config);
    console.log('[Sync] Pull done:', result.totalSynced, 'pulled,', result.totalErrors, 'errors');
    return result;
  });

  ipcMain.handle('sync:collection', async (_e: IpcMainInvokeEvent, config: SyncConfig, collection: string) => {
    const client = buildClient(config);
    if (collection === 'deletes') return syncDeletes(client);
    const def = syncFunctions.find((f) => f.table === collection);
    if (!def) return { collection, synced: 0, errors: [`Unknown collection: ${collection}`] };
    return syncTable(def.table, def.endpoint, client, def.transform);
  });

  ipcMain.handle('sync:pendingCounts', () => {
    const counts: Record<string, number> = {};
    for (const { table } of syncFunctions) {
      const rows = dbAll(
        `SELECT COUNT(*) as cnt FROM ${table} WHERE isSync = 0 AND (deletedAt IS NULL OR deletedAt = '')`
      );
      counts[table] = (rows[0]?.cnt as number) ?? 0;
    }
    const delRows = dbAll(`SELECT COUNT(*) as cnt FROM pending_deletes WHERE isSync = 0`);
    counts['deletes'] = (delRows[0]?.cnt as number) ?? 0;
    return counts;
  });
}
