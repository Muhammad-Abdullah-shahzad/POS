import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { quickProductsSchema, updateSettingsSchema } from '../validators/catalogValidators';
import {
  getQuickProducts,
  getSettings,
  updateQuickProducts,
  updateSettings,
} from '../controllers/settingsController';

const router = Router();
const staff = authorize('admin', 'manager', 'cashier');

router.use(authenticate);

router.route('/quick-products').get(getQuickProducts).put(staff, validate({ body: quickProductsSchema }), updateQuickProducts);

router.route('/').get(getSettings).put(authorize('admin', 'manager'), validate({ body: updateSettingsSchema }), updateSettings);

export default router;
