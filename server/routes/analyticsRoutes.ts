import express from 'express';
import {
  getRevenueTrend,
  getTopProducts,
  getPaymentMethodBreakdown,
  getExpenseCategoryBreakdown,
  getMonthlySummary,
} from '../controllers/analyticsController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.get('/revenue-trend', protect, authorize('admin', 'manager'), getRevenueTrend);
router.get('/top-products', protect, authorize('admin', 'manager'), getTopProducts);
router.get('/payment-methods', protect, authorize('admin', 'manager'), getPaymentMethodBreakdown);
router.get('/expense-categories', protect, authorize('admin', 'manager'), getExpenseCategoryBreakdown);
router.get('/monthly-summary', protect, authorize('admin', 'manager'), getMonthlySummary);

export default router;