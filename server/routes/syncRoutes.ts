/**
 * syncRoutes.ts
 *
 * Upsert sync:  POST /api/<collection>/sync
 * Delete sync:  POST /api/<collection>/sync/delete
 *
 * All routes require a valid JWT.
 */

import express from 'express';
import { protect } from '../middleware/auth';
import {
  syncProducts,    deleteProducts,
  syncCategories,  deleteCategories,
  syncOrders,      deleteOrders,
  syncCustomers,   deleteCustomers,
  syncEmployees,   deleteEmployees,
  syncExpenses,    deleteExpenses,
  syncSuppliers,   deleteSuppliers,
  syncBankNames,   deleteBankNames,
  syncBankAccounts,deleteBankAccounts,
  syncBankCards,   deleteBankCards,
  syncSettings,
} from '../controllers/syncController';

const router = express.Router();

// ── Upsert sync ───────────────────────────────────────────────────────────────
router.post('/products/sync',               protect, syncProducts);
router.post('/categories/sync',             protect, syncCategories);
router.post('/orders/sync',                 protect, syncOrders);
router.post('/customers/sync',              protect, syncCustomers);
router.post('/employees/sync',              protect, syncEmployees);
router.post('/expenses/sync',               protect, syncExpenses);
router.post('/suppliers/sync',              protect, syncSuppliers);
router.post('/banks/names/sync',            protect, syncBankNames);
router.post('/banks/accounts/sync',         protect, syncBankAccounts);
router.post('/banks/cards/sync',            protect, syncBankCards);
router.post('/settings/sync',               protect, syncSettings);

// ── Delete sync ───────────────────────────────────────────────────────────────
router.post('/products/sync/delete',        protect, deleteProducts);
router.post('/categories/sync/delete',      protect, deleteCategories);
router.post('/orders/sync/delete',          protect, deleteOrders);
router.post('/customers/sync/delete',       protect, deleteCustomers);
router.post('/employees/sync/delete',       protect, deleteEmployees);
router.post('/expenses/sync/delete',        protect, deleteExpenses);
router.post('/suppliers/sync/delete',       protect, deleteSuppliers);
router.post('/banks/names/sync/delete',     protect, deleteBankNames);
router.post('/banks/accounts/sync/delete',  protect, deleteBankAccounts);
router.post('/banks/cards/sync/delete',     protect, deleteBankCards);

export default router;
