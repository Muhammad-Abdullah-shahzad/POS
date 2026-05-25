/**
 * database.ts  –  sql.js wrapper (pure WASM, no native compilation needed)
 *
 * sql.js keeps the database in memory. We persist it to disk:
 *   - on every write (via saveDb())
 *   - when the Electron app is about to quit
 *
 * The DB file lives in Electron's userData directory so it survives updates.
 */
import { Database, SqlValue } from 'sql.js';
export type BindMap = {
    [key: string]: SqlValue;
};
/** Cast an unknown value from Record<string,unknown> to a sql.js-safe SqlValue */
export declare function v(val: unknown, fallback?: SqlValue): SqlValue;
export declare function initDb(): Promise<Database>;
export declare function saveDb(): void;
export declare function getDb(): Database;
/**
 * Run a SELECT and return all rows as plain objects.
 */
export declare function dbAll(sql: string, params?: BindMap): Record<string, unknown>[];
/**
 * Run a SELECT and return the first row, or null.
 */
export declare function dbGet(sql: string, params?: BindMap): Record<string, unknown> | null;
/**
 * Run an INSERT / UPDATE / DELETE and persist to disk.
 */
export declare function dbRun(sql: string, params?: BindMap): void;
/**
 * Run multiple statements inside a single transaction and persist once.
 */
export declare function dbTransaction(fn: (d: Database) => void): void;
/** Generate a 24-char hex ID that looks like a MongoDB ObjectId */
export declare function generateLocalId(): string;
/** Current ISO timestamp */
export declare function now(): string;
/**
 * Soft-delete a record:
 *  1. Sets deletedAt on the row (keeps it in the table, hidden from normal queries)
 *  2. Inserts into pending_deletes so the sync manager can push the delete to MongoDB
 */
export declare function softDelete(table: string, _id: string): void;
