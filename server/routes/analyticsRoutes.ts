import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { analyticsQuery } from '../validators/catalogValidators';
import {
  getExpenseCategoryBreakdown,
  getKpis,
  getMonthlySummary,
  getPaymentMethodBreakdown,
  getRevenueTrend,
  getTopProducts,
} from '../controllers/analyticsController';

const router = Router();

const restricted = authorize('admin', 'manager');
const allStaff = authorize('admin', 'manager', 'cashier');

router.use(authenticate, validate({ query: analyticsQuery }));

router.get('/revenue-trend', restricted, getRevenueTrend);
router.get('/top-products', allStaff, getTopProducts);
router.get('/payment-methods', restricted, getPaymentMethodBreakdown);
router.get('/expense-categories', restricted, getExpenseCategoryBreakdown);
router.get('/monthly-summary', restricted, getMonthlySummary);
router.get('/kpis', restricted, getKpis);

export default router;
