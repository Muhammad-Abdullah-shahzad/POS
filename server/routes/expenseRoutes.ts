import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createExpenseSchema, updateExpenseSchema } from '../validators/catalogValidators';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  updateExpense,
} from '../controllers/expenseController';

const router = Router();

router.use(authenticate);

router.route('/').get(getExpenses).post(validate({ body: createExpenseSchema }), createExpense);

router
  .route('/:id')
  .patch(validate({ params: idParam, body: updateExpenseSchema }), updateExpense)
  .delete(authorize('admin', 'manager'), validate({ params: idParam }), deleteExpense);

export default router;
