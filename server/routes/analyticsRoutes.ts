import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { analyticsQuery } from '../validators/catalogValidators';
import {
  getExpenseCategoryBreakdown,
  getMonthlySummary,
  getPaymentMethodBreakdown,
  getRevenueTrend,
  getTopProducts,
} from '../controllers/analyticsController';

const router = Router();

router.use(authenticate, authorize('admin', 'manager'), validate({ query: analyticsQuery }));

router.get('/revenue-trend', getRevenueTrend);
router.get('/top-products', getTopProducts);
router.get('/payment-methods', getPaymentMethodBreakdown);
router.get('/expense-categories', getExpenseCategoryBreakdown);
router.get('/monthly-summary', getMonthlySummary);

export default router;
