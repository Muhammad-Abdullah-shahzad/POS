import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { bankAccountSchema, bankCardSchema, bankNameSchema } from '../validators/catalogValidators';
import {
  addBankAccount,
  addBankCard,
  addBankName,
  deleteBankAccount,
  deleteBankCard,
  deleteBankName,
  getBankAccounts,
  getBankCards,
  getBankNames,
} from '../controllers/bankController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router.route('/names').get(getBankNames).post(managers, validate({ body: bankNameSchema }), addBankName);
router.delete('/names/:id', managers, validate({ params: idParam }), deleteBankName);

router
  .route('/accounts')
  .get(getBankAccounts)
  .post(managers, validate({ body: bankAccountSchema }), addBankAccount);
router.delete('/accounts/:id', managers, validate({ params: idParam }), deleteBankAccount);

router.route('/cards').get(getBankCards).post(managers, validate({ body: bankCardSchema }), addBankCard);
router.delete('/cards/:id', managers, validate({ params: idParam }), deleteBankCard);

export default router;
