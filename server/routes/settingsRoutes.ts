import express from 'express';
import { getSettings, getQuickProducts, updateQuickProducts, updateSettings } from '../controllers/settingsController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.get('/quick-products', protect, getQuickProducts);
router.put('/quick-products', protect, authorize('admin', 'manager', 'cashier'), updateQuickProducts);

router.route('/')
  .get(getSettings)
  .put(protect, authorize('admin'), updateSettings);

export default router;
