/**
 * database.ts  –  sql.js wrapper (pure WASM, no native compilation needed)
 *
 * sql.js keeps the database in memory. We persist it to disk:
 *   - on every write (via saveDb())
 *   - when the Electron app is about to quit
 *
 * The DB file lives in Electron's userData directory so it survives updates.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import initSqlJs, { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { CREATE_TABLES_SQL } from './schema';

// sql.js named-parameter binding map
export type BindMap = { [key: string]: SqlValue };

/** Cast an unknown value from Record<string,unknown> to a sql.js-safe SqlValue */
export function v(val: unknown, fallback: SqlValue = null): SqlValue {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string' || typeof val === 'number' || val instanceof Uint8Array) return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  return String(val);
}

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;
let dbPath: string = '';

// ─────────────────────────────────────────────────────────────────────────────
// Initialise
// ─────────────────────────────────────────────────────────────────────────────

export async function initDb(): Promise<Database> {
  if (db) return db;

  SQL = await initSqlJs();

  dbPath = path.join(app.getPath('userData'), 'pos_local.db');
  console.log('[DB] SQLite path:', dbPath);

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('[DB] Loaded existing database from disk');
  } else {
    db = new SQL.Database();
    console.log('[DB] Created new in-memory database');
  }

  // Create tables if they don't exist yet
  db.run(CREATE_TABLES_SQL);

  // ── Migrations: add columns that didn't exist in older DB versions ──────
  runMigrations(db);

  // Persist immediately so the file exists on disk
  saveDb();

  console.log('[DB] Tables initialised');
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migrations — safely add columns that didn't exist in older DB versions
// ─────────────────────────────────────────────────────────────────────────────

function addColumnIfMissing(db: Database, table: string, column: string, definition: string): void {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Migration: added ${table}.${column}`);
  } catch {
    // Column already exists — safe to ignore
  }
}

function runMigrations(db: Database): void {
  const tables = [
    'products', 'categories', 'orders', 'customers', 'employees',
    'expenses', 'suppliers', 'bank_names', 'bank_accounts', 'bank_cards',
    'settings', 'users',
  ];

  for (const table of tables) {
    addColumnIfMissing(db, table, 'deletedAt', 'TEXT');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Persist to disk
// ─────────────────────────────────────────────────────────────────────────────

export function saveDb(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// Synchronous getter (call after initDb() has resolved)
// ─────────────────────────────────────────────────────────────────────────────

export function getDb(): Database {
  if (!db) throw new Error('[DB] Database not initialised. Call initDb() first.');
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers  (mirror the better-sqlite3 API used in IPC handlers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a SELECT and return all rows as plain objects.
 */
export function dbAll(sql: string, params: BindMap = {}): Record<string, unknown>[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return rows;
}

/**
 * Run a SELECT and return the first row, or null.
 */
export function dbGet(sql: string, params: BindMap = {}): Record<string, unknown> | null {
  const rows = dbAll(sql, params);
  return rows[0] ?? null;
}

/**
 * Run an INSERT / UPDATE / DELETE and persist to disk.
 */
export function dbRun(sql: string, params: BindMap = {}): void {
  const d = getDb();
  d.run(sql, params);
  saveDb();
}

/**
 * Run multiple statements inside a single transaction and persist once.
 */
export function dbTransaction(fn: (d: Database) => void): void {
  const d = getDb();
  d.run('BEGIN');
  try {
    fn(d);
    d.run('COMMIT');
    saveDb();
  } catch (err) {
    d.run('ROLLBACK');
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a 24-char hex ID that looks like a MongoDB ObjectId */
export function generateLocalId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return timestamp + random;
}

/** Current ISO timestamp */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Soft-delete a record:
 *  1. Sets deletedAt on the row (keeps it in the table, hidden from normal queries)
 *  2. Inserts into pending_deletes so the sync manager can push the delete to MongoDB
 */
export function softDelete(table: string, _id: string): void {
  const ts = now();
  dbTransaction((d) => {
    // Mark the row as deleted (add deletedAt column if it doesn't exist yet — safe migration)
    try {
      d.run(`ALTER TABLE ${table} ADD COLUMN deletedAt TEXT`, {});
    } catch { /* column already exists */ }

    d.run(
      `UPDATE ${table} SET deletedAt=$ts, updatedAt=$ts, isSync=0 WHERE _id=$id`,
      { $ts: ts, $id: _id } as BindMap
    );

    d.run(
      `INSERT INTO pending_deletes (tableName, localId, deletedAt, isSync)
       VALUES ($table, $id, $ts, 0)`,
      { $table: table, $id: _id, $ts: ts } as BindMap
    );
  });
}
