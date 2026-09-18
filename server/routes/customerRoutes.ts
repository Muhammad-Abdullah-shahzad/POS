import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import {
  createCustomerSchema,
  customerTransactionSchema,
  searchQuery,
  updateCustomerSchema,
} from '../validators/catalogValidators';
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  recordCustomerTransaction,
  resetLoyaltyPoints,
  updateCustomer,
} from '../controllers/customerController';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(validate({ query: searchQuery }), getCustomers)
  .post(validate({ body: createCustomerSchema }), createCustomer);

router
  .route('/:id')
  .put(validate({ params: idParam, body: updateCustomerSchema }), updateCustomer)
  .delete(validate({ params: idParam }), deleteCustomer);

router.post(
  '/:id/transaction',
  validate({ params: idParam, body: customerTransactionSchema }),
  recordCustomerTransaction
);
router.post('/:id/reset-points', validate({ params: idParam }), resetLoyaltyPoints);

export default router;
