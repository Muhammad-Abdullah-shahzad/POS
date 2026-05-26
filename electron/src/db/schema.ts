/**
 * SQLite schema definitions.
 * Mirrors the MongoDB models exactly, with two extra fields on every table:
 *   - localId  : auto-increment primary key (internal use only)
 *   - isSync   : 0 = not synced, 1 = synced (default 0)
 *
 * The `_id` column stores the MongoDB ObjectId string so that upsert on the
 * web server can match records correctly.
 */

export const CREATE_TABLES_SQL = `

-- ─────────────────────────────────────────────
-- PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  localId     INTEGER PRIMARY KEY AUTOINCREMENT,
  _id         TEXT    UNIQUE,
  name        TEXT    NOT NULL,
  sku         TEXT,
  barcode     TEXT    NOT NULL UNIQUE,
  category    TEXT    NOT NULL,
  price       REAL    NOT NULL DEFAULT 0,
  vatRate     REAL    NOT NULL DEFAULT 0,
  vatType     TEXT    NOT NULL DEFAULT 'exclusive',
  costPrice   REAL    NOT NULL DEFAULT 0,
  stock       INTEGER NOT NULL DEFAULT 0,
  drs         REAL             DEFAULT 0,
  image       TEXT,
  createdAt   TEXT,
  updatedAt   TEXT,
  isSync      INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  localId     INTEGER PRIMARY KEY AUTOINCREMENT,
  _id         TEXT    UNIQUE,
  name        TEXT    NOT NULL UNIQUE,
  items       TEXT    NOT NULL DEFAULT '[]',   -- JSON array stored as text
  vatRate     REAL             DEFAULT 0,
  vatType     TEXT             DEFAULT 'exclusive',
  createdAt   TEXT,
  updatedAt   TEXT,
  isSync      INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- ORDERS  (items stored as JSON text)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  localId              INTEGER PRIMARY KEY AUTOINCREMENT,
  _id                  TEXT    UNIQUE,
  invoiceId            TEXT    NOT NULL UNIQUE,
  items                TEXT    NOT NULL DEFAULT '[]',  -- JSON array
  subtotal             REAL    NOT NULL DEFAULT 0,
  totalVAT             REAL    NOT NULL DEFAULT 0,
  discount             REAL    NOT NULL DEFAULT 0,
  totalDRS             REAL             DEFAULT 0,
  total                REAL    NOT NULL DEFAULT 0,
  paymentMethod        TEXT    NOT NULL,
  splitCash            REAL,
  splitCard            REAL,
  status               TEXT    NOT NULL DEFAULT 'completed',
  voidReason           TEXT,
  voidedAt             TEXT,
  voidedBy             TEXT,
  voidedByEmployee     TEXT,
  voidedByEmployeeName TEXT,
  createdAt            TEXT,
  updatedAt            TEXT,
  isSync               INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- CUSTOMERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  localId       INTEGER PRIMARY KEY AUTOINCREMENT,
  _id           TEXT    UNIQUE,
  name          TEXT    NOT NULL,
  contactNum1   TEXT    NOT NULL,
  contactNum2   TEXT             DEFAULT '',
  email         TEXT             DEFAULT '',
  address       TEXT             DEFAULT '',
  eircode       TEXT             DEFAULT '',
  qrCode        TEXT             DEFAULT '',
  barcode       TEXT             DEFAULT '',
  birthday      TEXT,
  anniversary   TEXT,
  timesVisited  INTEGER          DEFAULT 0,
  totalAmount   REAL             DEFAULT 0,
  lastVisit     TEXT             DEFAULT '',
  loyaltyPoints INTEGER          DEFAULT 0,
  createdAt     TEXT,
  updatedAt     TEXT,
  isSync        INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- EMPLOYEES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  localId   INTEGER PRIMARY KEY AUTOINCREMENT,
  _id       TEXT    UNIQUE,
  name      TEXT    NOT NULL,
  contactNo TEXT    NOT NULL,
  emailId   TEXT    NOT NULL,
  address   TEXT    NOT NULL,
  role      TEXT    NOT NULL,
  gender    TEXT    NOT NULL,
  dob       TEXT    NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  isSync    INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- EXPENSE CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  localId   INTEGER PRIMARY KEY AUTOINCREMENT,
  _id       TEXT    UNIQUE,
  name      TEXT    NOT NULL UNIQUE,
  createdAt TEXT,
  updatedAt TEXT,
  isSync    INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- EXPENSES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  localId       INTEGER PRIMARY KEY AUTOINCREMENT,
  _id           TEXT    UNIQUE,
  title         TEXT    NOT NULL,
  amount        REAL    NOT NULL,
  category      TEXT    NOT NULL,
  date          TEXT    NOT NULL,
  paymentMethod TEXT    NOT NULL,
  notes         TEXT,
  attachmentUrl TEXT,
  createdAt     TEXT,
  updatedAt     TEXT,
  isSync        INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- EMPLOYEE DAMAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_damages (
  localId      INTEGER PRIMARY KEY AUTOINCREMENT,
  _id          TEXT    UNIQUE,
  employeeId   TEXT    NOT NULL,
  employeeName TEXT    NOT NULL,
  item         TEXT    NOT NULL,
  value        REAL    NOT NULL DEFAULT 0,
  deduction    REAL    NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'Pending Approval',
  date         TEXT    NOT NULL,
  createdAt    TEXT,
  updatedAt    TEXT,
  isSync       INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- SUPPLIERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  localId   INTEGER PRIMARY KEY AUTOINCREMENT,
  _id       TEXT    UNIQUE,
  name      TEXT    NOT NULL,
  contact   TEXT    NOT NULL,
  emailId   TEXT    NOT NULL,
  address   TEXT    NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  isSync    INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- BANK NAMES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_names (
  localId   INTEGER PRIMARY KEY AUTOINCREMENT,
  _id       TEXT    UNIQUE,
  name      TEXT    NOT NULL UNIQUE,
  createdAt TEXT,
  updatedAt TEXT,
  isSync    INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- BANK ACCOUNTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  localId     INTEGER PRIMARY KEY AUTOINCREMENT,
  _id         TEXT    UNIQUE,
  bankName    TEXT    NOT NULL,
  type        TEXT    NOT NULL,
  accountName TEXT    NOT NULL,
  iban        TEXT    NOT NULL,
  bic         TEXT    NOT NULL,
  createdAt   TEXT,
  updatedAt   TEXT,
  isSync      INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- BANK CARDS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_cards (
  localId     INTEGER PRIMARY KEY AUTOINCREMENT,
  _id         TEXT    UNIQUE,
  bankName    TEXT    NOT NULL,
  accountName TEXT    NOT NULL,
  type        TEXT    NOT NULL,
  cardNumber  TEXT    NOT NULL,
  cardName    TEXT    NOT NULL,
  expiryDate  TEXT    NOT NULL,
  createdAt   TEXT,
  updatedAt   TEXT,
  isSync      INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- SETTINGS  (single-row table)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  localId                INTEGER PRIMARY KEY AUTOINCREMENT,
  _id                    TEXT    UNIQUE,
  shopName               TEXT    NOT NULL DEFAULT 'My Retail Store',
  shopAddress            TEXT    NOT NULL DEFAULT '123 Retail Lane',
  shopPhone              TEXT             DEFAULT '',
  shopEmail              TEXT             DEFAULT '',
  shopWebsite            TEXT             DEFAULT '',
  receiptFooter          TEXT             DEFAULT '',
  defaultVatRate         REAL    NOT NULL DEFAULT 20,
  isVatInclusiveDefault  INTEGER NOT NULL DEFAULT 1,
  loyaltyPointsPerEuro   REAL             DEFAULT 1,
  loyaltyRewardThreshold REAL             DEFAULT 100,
  loyaltyRewardValue     REAL             DEFAULT 5,
  quickProducts          TEXT             DEFAULT '[]',  -- JSON array
  createdAt              TEXT,
  updatedAt              TEXT,
  isSync                 INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- PENDING DELETES  (tracks records deleted locally that need to be deleted on the server)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_deletes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tableName TEXT    NOT NULL,
  localId   TEXT    NOT NULL,
  deletedAt TEXT    NOT NULL,
  isSync    INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────
-- USERS  (local auth)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  localId      INTEGER PRIMARY KEY AUTOINCREMENT,
  _id          TEXT    UNIQUE,
  name         TEXT    NOT NULL,
  email        TEXT    NOT NULL UNIQUE,
  passwordHash TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT 'cashier',
  createdAt    TEXT,
  updatedAt    TEXT,
  isSync       INTEGER NOT NULL DEFAULT 0
);
`;
