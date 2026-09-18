import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { expenseCategorySchema } from '../validators/catalogValidators';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategories,
} from '../controllers/expenseCategoryController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router
  .route('/')
  .get(getExpenseCategories)
  .post(managers, validate({ body: expenseCategorySchema }), createExpenseCategory);

router.delete('/:id', managers, validate({ params: idParam }), deleteExpenseCategory);

export default router;
