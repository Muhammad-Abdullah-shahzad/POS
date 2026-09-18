import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { dashboardQuery } from '../validators/catalogValidators';
import { getDashboardStats } from '../controllers/dashboardController';

const router = Router();

router.get(
  '/stats',
  authenticate,
  authorize('admin', 'manager'),
  validate({ query: dashboardQuery }),
  getDashboardStats
);

export default router;
