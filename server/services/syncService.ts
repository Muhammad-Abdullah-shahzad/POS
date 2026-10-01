/**
 * Offline sync for the desktop till.
 *
 * The Electron app keeps its own SQLite copy and pushes changes here when it
 * reconnects. Records are matched on `_id`, which is generated locally in
 * MongoDB's id format, so a row created offline keeps its identity once it
 * reaches the server.
 *
 * Tenant safety comes from the model plugin: the injected `tenantId` is part of
 * every filter, so a till can only ever write into its own company's data.
 */
import { Model, Types } from 'mongoose';
import { logger } from '../core/logger';
import { getTenantId } from '../core/tenantContext';
import { isDataUrlImage, storeDataUrlImage } from './imageStorageService';
import Product from '../models/Product';
import Category from '../models/Category';
import Order from '../models/Order';
import Customer from '../models/Customer';
import CustomerPayment from '../models/CustomerPayment';
import Employee from '../models/Employee';
import Expense from '../models/Expense';
import ExpenseCategory from '../models/ExpenseCategory';
import EmployeeDamage from '../models/EmployeeDamage';
import Supplier from '../models/Supplier';
import SupplierInvoice from '../models/SupplierInvoice';
import WastageEntry from '../models/WastageEntry';
import Settings from '../models/Settings';
import ProductReturn from '../models/ProductReturn';
import { BankAccount, BankCard, BankName } from '../models/Bank';

type SyncRecord = Record<string, unknown>;

interface SyncCollectionConfig {
  model: Model<any>;
  label: string;
  /** Adjusts a record pushed by a till before it is saved. */
  prepare?: (record: SyncRecord) => Promise<SyncRecord>;
}

/**
 * Desktop tills keep new product photos inline as base64 until they sync.
 * They belong on Google Drive, with only the link in the database. If Drive
 * is unavailable the photo is kept as it is rather than lost.
 */
async function moveInlineImageToDrive(record: SyncRecord): Promise<SyncRecord> {
  const tenantId = getTenantId();
  if (!tenantId || !isDataUrlImage(record.image)) return record;

  try {
    return { ...record, image: await storeDataUrlImage('products', tenantId, record.image) };
  } catch (error) {
    logger.warn({ err: error, productId: record._id }, 'Kept an inline product photo; moving it to Drive failed');
    return record;
  }
}

/** Every collection the desktop app may sync, keyed by its API path segment. */
export const SYNC_COLLECTIONS = {
  products: { model: Product as Model<any>, label: 'products', prepare: moveInlineImageToDrive },
  categories: { model: Category as Model<any>, label: 'categories' },
  orders: { model: Order as Model<any>, label: 'orders' },
  customers: { model: Customer as Model<any>, label: 'customers' },
  'customer-payments': { model: CustomerPayment as Model<any>, label: 'customer payments' },
  employees: { model: Employee as Model<any>, label: 'employees' },
  expenses: { model: Expense as Model<any>, label: 'expenses' },
  'expense-categories': { model: ExpenseCategory as Model<any>, label: 'expense categories' },
  'employee-damages': { model: EmployeeDamage as Model<any>, label: 'employee damages' },
  suppliers: { model: Supplier as Model<any>, label: 'suppliers' },
  'supplier-invoices': { model: SupplierInvoice as Model<any>, label: 'supplier invoices' },
  wastage: { model: WastageEntry as Model<any>, label: 'wastage entries' },
  'banks/names': { model: BankName as Model<any>, label: 'bank names' },
  'banks/accounts': { model: BankAccount as Model<any>, label: 'bank accounts' },
  'banks/cards': { model: BankCard as Model<any>, label: 'bank cards' },
  'product-returns': { model: ProductReturn as Model<any>, label: 'product returns' },
  settings: { model: Settings as Model<any>, label: 'settings' },
} satisfies Record<string, SyncCollectionConfig>;

export type SyncCollection = keyof typeof SYNC_COLLECTIONS;

export interface SyncOutcome {
  upserted: number;
  skipped: number;
  errors: string[];
}

export interface DeleteOutcome {
  deleted: number;
  errors: string[];
}

/** Fields that exist only in the local SQLite schema. */
const LOCAL_ONLY_FIELDS = ['localId', 'isSync', 'deletedAt', 'tenantId', '__v'];

const UPSERT_CONCURRENCY = 20;

/**
 * Strip local bookkeeping and drop empty values.
 *
 * Empty strings are skipped rather than written: the local schema fills unset
 * columns with '', and writing those through would blank required fields.
 */
function toUpdateDocument(record: Record<string, unknown>): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (LOCAL_ONLY_FIELDS.includes(key) || key === '_id') continue;
    if (value === undefined || value === null || value === '') continue;
    update[key] = value;
  }

  return update;
}

const asId = (value: unknown): unknown =>
  typeof value === 'string' && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : value;

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(work));
  }
}

/**
 * Every record of a collection for the company, uncapped. A till's pull
 * compares against this list to find records deleted on the web, so it must
 * be complete: a capped list would make the till delete records it still needs.
 */
export async function listAllRecords(collection: SyncCollection): Promise<Record<string, unknown>[]> {
  const { model } = SYNC_COLLECTIONS[collection];
  return model.find().lean();
}

/** Upsert a batch of records pushed by a till. */
export async function upsertRecords(
  collection: SyncCollection,
  records: Record<string, unknown>[]
): Promise<SyncOutcome> {
  const { model, prepare } = SYNC_COLLECTIONS[collection] as SyncCollectionConfig;
  const outcome: SyncOutcome = { upserted: 0, skipped: 0, errors: [] };

  // Settings is a single document per company; only the first record counts.
  const payload = collection === 'settings' ? records.slice(0, 1) : records;

  await inBatches(payload, UPSERT_CONCURRENCY, async (record) => {
    if (!record?._id) {
      outcome.skipped += 1;
      return;
    }

    try {
      const prepared = prepare ? await prepare(record) : record;
      await model.updateOne(
        { _id: asId(record._id) },
        { $set: toUpdateDocument(prepared) },
        { upsert: true, runValidators: false }
      );
      outcome.upserted += 1;
    } catch (error: any) {
      outcome.errors.push(`${String(record._id)}: ${error.message}`);
    }
  });

  if (outcome.errors.length > 0) {
    logger.warn({ collection, errors: outcome.errors.length }, 'Sync completed with errors');
  }

  return outcome;
}

/** Apply deletions the till performed while offline. */
export async function deleteRecords(collection: SyncCollection, ids: string[]): Promise<DeleteOutcome> {
  const { model } = SYNC_COLLECTIONS[collection];

  try {
    const result = await model.deleteMany({ _id: { $in: ids.map(asId) } });
    return { deleted: result.deletedCount ?? 0, errors: [] };
  } catch (error: any) {
    return { deleted: 0, errors: [error.message] };
  }
}
