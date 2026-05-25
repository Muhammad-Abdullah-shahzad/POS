/**
 * syncManager.ts
 * Syncs local SQLite → remote MongoDB.
 * Also syncs soft-deletes: sends pending_deletes to /sync/delete on the server.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import axios, { AxiosInstance } from 'axios';
import { dbAll, dbRun } from '../db/database';

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

// ── Upsert sync ───────────────────────────────────────────────────────────────

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
    result.errors.push(err?.response?.data?.message || err.message || 'Unknown error');
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
  expenses:      'expenses',
  suppliers:     'suppliers',
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

// ── Collection definitions ────────────────────────────────────────────────────

const parseJson = (field: string) => (row: Record<string, unknown>) => ({
  ...row,
  [field]: JSON.parse((row[field] as string) || '[]'),
});

const syncFunctions: Array<{
  table: string;
  endpoint: string;
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
}> = [
  { table: 'products',      endpoint: '/products/sync' },
  { table: 'categories',    endpoint: '/categories/sync',  transform: parseJson('items') },
  { table: 'orders',        endpoint: '/orders/sync',      transform: parseJson('items') },
  { table: 'customers',     endpoint: '/customers/sync' },
  { table: 'employees',     endpoint: '/employees/sync' },
  { table: 'expenses',      endpoint: '/expenses/sync' },
  { table: 'suppliers',     endpoint: '/suppliers/sync' },
  { table: 'bank_names',    endpoint: '/banks/names/sync' },
  { table: 'bank_accounts', endpoint: '/banks/accounts/sync' },
  { table: 'bank_cards',    endpoint: '/banks/cards/sync' },
  { table: 'settings',      endpoint: '/settings/sync',    transform: parseJson('quickProducts') },
];

// ── Master sync ───────────────────────────────────────────────────────────────

async function syncAll(config: SyncConfig) {
  const client = buildClient(config);

  const settled = await Promise.allSettled([
    ...syncFunctions.map(({ table, endpoint, transform }) =>
      syncTable(table, endpoint, client, transform)
    ),
    syncDeletes(client),
  ]);

  const results: SyncResult[] = settled.map((r, i) => {
    const name = i < syncFunctions.length ? syncFunctions[i].table : 'deletes';
    if (r.status === 'fulfilled') return r.value;
    return { collection: name, synced: 0, errors: [r.reason?.message || 'Failed'] };
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
