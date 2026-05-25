"use strict";
/**
 * database.ts  –  sql.js wrapper (pure WASM, no native compilation needed)
 *
 * sql.js keeps the database in memory. We persist it to disk:
 *   - on every write (via saveDb())
 *   - when the Electron app is about to quit
 *
 * The DB file lives in Electron's userData directory so it survives updates.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.v = v;
exports.initDb = initDb;
exports.saveDb = saveDb;
exports.getDb = getDb;
exports.dbAll = dbAll;
exports.dbGet = dbGet;
exports.dbRun = dbRun;
exports.dbTransaction = dbTransaction;
exports.generateLocalId = generateLocalId;
exports.now = now;
exports.softDelete = softDelete;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const sql_js_1 = __importDefault(require("sql.js"));
const schema_1 = require("./schema");
/** Cast an unknown value from Record<string,unknown> to a sql.js-safe SqlValue */
function v(val, fallback = null) {
    if (val === undefined || val === null)
        return fallback;
    if (typeof val === 'string' || typeof val === 'number' || val instanceof Uint8Array)
        return val;
    if (typeof val === 'boolean')
        return val ? 1 : 0;
    return String(val);
}
let db = null;
let SQL = null;
let dbPath = '';
// ─────────────────────────────────────────────────────────────────────────────
// Initialise
// ─────────────────────────────────────────────────────────────────────────────
async function initDb() {
    if (db)
        return db;
    SQL = await (0, sql_js_1.default)();
    dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'pos_local.db');
    console.log('[DB] SQLite path:', dbPath);
    if (fs_1.default.existsSync(dbPath)) {
        const fileBuffer = fs_1.default.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('[DB] Loaded existing database from disk');
    }
    else {
        db = new SQL.Database();
        console.log('[DB] Created new in-memory database');
    }
    // Create tables if they don't exist yet
    db.run(schema_1.CREATE_TABLES_SQL);
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
function addColumnIfMissing(db, table, column, definition) {
    try {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`[DB] Migration: added ${table}.${column}`);
    }
    catch {
        // Column already exists — safe to ignore
    }
}
function runMigrations(db) {
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
function saveDb() {
    if (!db || !dbPath)
        return;
    const data = db.export();
    fs_1.default.writeFileSync(dbPath, Buffer.from(data));
}
// ─────────────────────────────────────────────────────────────────────────────
// Synchronous getter (call after initDb() has resolved)
// ─────────────────────────────────────────────────────────────────────────────
function getDb() {
    if (!db)
        throw new Error('[DB] Database not initialised. Call initDb() first.');
    return db;
}
// ─────────────────────────────────────────────────────────────────────────────
// Query helpers  (mirror the better-sqlite3 API used in IPC handlers)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Run a SELECT and return all rows as plain objects.
 */
function dbAll(sql, params = {}) {
    const d = getDb();
    const stmt = d.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}
/**
 * Run a SELECT and return the first row, or null.
 */
function dbGet(sql, params = {}) {
    const rows = dbAll(sql, params);
    return rows[0] ?? null;
}
/**
 * Run an INSERT / UPDATE / DELETE and persist to disk.
 */
function dbRun(sql, params = {}) {
    const d = getDb();
    d.run(sql, params);
    saveDb();
}
/**
 * Run multiple statements inside a single transaction and persist once.
 */
function dbTransaction(fn) {
    const d = getDb();
    d.run('BEGIN');
    try {
        fn(d);
        d.run('COMMIT');
        saveDb();
    }
    catch (err) {
        d.run('ROLLBACK');
        throw err;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
/** Generate a 24-char hex ID that looks like a MongoDB ObjectId */
function generateLocalId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return timestamp + random;
}
/** Current ISO timestamp */
function now() {
    return new Date().toISOString();
}
/**
 * Soft-delete a record:
 *  1. Sets deletedAt on the row (keeps it in the table, hidden from normal queries)
 *  2. Inserts into pending_deletes so the sync manager can push the delete to MongoDB
 */
function softDelete(table, _id) {
    const ts = now();
    dbTransaction((d) => {
        // Mark the row as deleted (add deletedAt column if it doesn't exist yet — safe migration)
        try {
            d.run(`ALTER TABLE ${table} ADD COLUMN deletedAt TEXT`, {});
        }
        catch { /* column already exists */ }
        d.run(`UPDATE ${table} SET deletedAt=$ts, updatedAt=$ts, isSync=0 WHERE _id=$id`, { $ts: ts, $id: _id });
        d.run(`INSERT INTO pending_deletes (tableName, localId, deletedAt, isSync)
       VALUES ($table, $id, $ts, 0)`, { $table: table, $id: _id, $ts: ts });
    });
}
//# sourceMappingURL=database.js.map