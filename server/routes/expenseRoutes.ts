import express from 'express';
import { getExpenses, createExpense } from '../controllers/expenseController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager'), getExpenses)
  .post(protect, authorize('admin', 'manager'), createExpense);

export default router;
