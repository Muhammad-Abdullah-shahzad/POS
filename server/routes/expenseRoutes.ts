import express from 'express';
import { getExpenses, createExpense } from '../controllers/expenseController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager', 'cashier'), getExpenses)
  .post(protect, authorize('admin', 'manager', 'cashier'), createExpense);

export default router;
