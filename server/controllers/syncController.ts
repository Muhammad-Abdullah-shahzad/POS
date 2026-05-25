/**
 * syncController.ts
 *
 * Handles POST /api/<collection>/sync requests from the Electron desktop app.
 *
 * Each handler receives an array of records from the local SQLite DB and
 * upserts them into MongoDB using updateOne with { upsert: true }, matching
 * on the `_id` field.
 *
 * The `isSync` field is stripped before saving — it's a local-only field.
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';
import Order from '../models/Order';
import Customer from '../models/Customer';
import Employee from '../models/Employee';
import Expense from '../models/Expense';
import Supplier from '../models/Supplier';
import { BankName, BankAccount, BankCard } from '../models/Bank';
import Settings from '../models/Settings';
import { successResponse, errorResponse } from '../utils/response';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: strip local-only fields and normalise _id
// ─────────────────────────────────────────────────────────────────────────────

async function upsertMany(
  model: mongoose.Model<any>,
  records: any[]
): Promise<{ upserted: number; errors: string[] }> {
  let upserted = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      // Strip all local-only fields before sending to MongoDB
      const { localId, isSync, deletedAt, ...rest } = record;

      // Build clean update doc — skip null/empty values
      const update: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(rest)) {
        if (val !== undefined && val !== null && val !== '') update[k] = val;
      }

      // Match on _id (the SQLite _id IS the MongoDB _id)
      const filter = mongoose.Types.ObjectId.isValid(rest._id)
        ? { _id: new mongoose.Types.ObjectId(rest._id) }
        : { _id: rest._id };

      await model.updateOne(filter, { $set: update }, { upsert: true });
      upserted++;
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  return { upserted, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync handlers
// ─────────────────────────────────────────────────────────────────────────────

export const syncProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Product, records);
    res.json(successResponse(result, `Synced ${result.upserted} products`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Category, records);
    res.json(successResponse(result, `Synced ${result.upserted} categories`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Order, records);
    res.json(successResponse(result, `Synced ${result.upserted} orders`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Customer, records);
    res.json(successResponse(result, `Synced ${result.upserted} customers`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Employee, records);
    res.json(successResponse(result, `Synced ${result.upserted} employees`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Expense, records);
    res.json(successResponse(result, `Synced ${result.upserted} expenses`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(Supplier, records);
    res.json(successResponse(result, `Synced ${result.upserted} suppliers`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncBankNames = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(BankName, records);
    res.json(successResponse(result, `Synced ${result.upserted} bank names`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(BankAccount, records);
    res.json(successResponse(result, `Synced ${result.upserted} bank accounts`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncBankCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    const result = await upsertMany(BankCard, records);
    res.json(successResponse(result, `Synced ${result.upserted} bank cards`));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

export const syncSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const records: any[] = req.body;
    if (!Array.isArray(records)) { res.status(400).json(errorResponse('Expected an array')); return; }
    // Settings is a singleton — just upsert the first record
    const result = await upsertMany(Settings, records.slice(0, 1));
    res.json(successResponse(result, 'Settings synced'));
  } catch (err: any) {
    res.status(500).json(errorResponse('Sync failed', err.message));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE SYNC
// Receives { ids: string[] } and hard-deletes those documents from MongoDB.
// Called when the Electron app syncs soft-deleted records.
// ─────────────────────────────────────────────────────────────────────────────

async function deleteMany(
  model: mongoose.Model<any>,
  ids: string[]
): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      const filter = mongoose.Types.ObjectId.isValid(id)
        ? { _id: new mongoose.Types.ObjectId(id) }
        : { _id: id };
      await model.deleteOne(filter);
      deleted++;
    } catch (err: any) {
      errors.push(err.message);
    }
  }
  return { deleted, errors };
}

function deleteSyncHandler(model: mongoose.Model<any>, label: string) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) { res.status(400).json(errorResponse('Expected { ids: string[] }')); return; }
      const result = await deleteMany(model, ids);
      res.json(successResponse(result, `Deleted ${result.deleted} ${label}`));
    } catch (err: any) {
      res.status(500).json(errorResponse('Delete sync failed', err.message));
    }
  };
}

export const deleteProducts     = deleteSyncHandler(Product,     'products');
export const deleteCategories   = deleteSyncHandler(Category,    'categories');
export const deleteOrders       = deleteSyncHandler(Order,       'orders');
export const deleteCustomers    = deleteSyncHandler(Customer,    'customers');
export const deleteEmployees    = deleteSyncHandler(Employee,    'employees');
export const deleteExpenses     = deleteSyncHandler(Expense,     'expenses');
export const deleteSuppliers    = deleteSyncHandler(Supplier,    'suppliers');
export const deleteBankNames    = deleteSyncHandler(BankName,    'bank names');
export const deleteBankAccounts = deleteSyncHandler(BankAccount, 'bank accounts');
export const deleteBankCards    = deleteSyncHandler(BankCard,    'bank cards');
