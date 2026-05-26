import express from 'express';
import { getExpenseCategories, createExpenseCategory, deleteExpenseCategory } from '../controllers/expenseCategoryController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager', 'cashier'), getExpenseCategories)
  .post(protect, authorize('admin', 'manager'), createExpenseCategory);

router.route('/:id')
  .delete(protect, authorize('admin', 'manager'), deleteExpenseCategory);

export default router;
