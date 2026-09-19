import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { recordWastageSchema } from '../validators/catalogValidators';
import { createWastage, getWastage } from '../controllers/wastageController';

const router = Router();

// Anyone who can adjust stock can write it off. Entries are an audit trail,
// so there is no editing or deleting.
const staff = authorize('admin', 'manager', 'cashier');

router.use(authenticate);

router.route('/').get(getWastage).post(staff, validate({ body: recordWastageSchema }), createWastage);

export default router;
