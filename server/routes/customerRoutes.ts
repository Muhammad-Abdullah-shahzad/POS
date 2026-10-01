import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import {
  createCustomerSchema,
  customerEntryParams,
  customerPaymentSchema,
  openingBalanceSchema,
  updateCustomerPaymentSchema,
  updateCustomerSaleSchema,
  customerTransactionSchema,
  searchQuery,
  updateCustomerSchema,
} from '../validators/catalogValidators';
import {
  addPayment,
  createCustomer,
  deleteCustomerPayment,
  deleteCustomer,
  getCustomers,
  getLedger,
  recordCustomerTransaction,
  resetLoyaltyPoints,
  updateCustomer,
  updateCustomerPayment,
  updateCustomerSale,
  updateOpeningBalance,
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

// Credit ledger & manual payments
router.get('/:id/ledger', validate({ params: idParam }), getLedger);
router.post('/:id/payments', validate({ params: idParam, body: customerPaymentSchema }), addPayment);

// Corrections from the account statement change money already recorded, so only managers make them.
const managers = authorize('admin', 'manager');
router.delete('/:id/payments/:entryId', managers, validate({ params: customerEntryParams }), deleteCustomerPayment);
router.patch('/:id/payments/:entryId', managers, validate({ params: customerEntryParams, body: updateCustomerPaymentSchema }), updateCustomerPayment);
router.patch('/:id/sales/:entryId', managers, validate({ params: customerEntryParams, body: updateCustomerSaleSchema }), updateCustomerSale);
router.patch('/:id/opening-balance', managers, validate({ params: idParam, body: openingBalanceSchema }), updateOpeningBalance);

export default router;

