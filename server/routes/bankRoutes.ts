import express from 'express';
import { getBankNames, addBankName, getBankAccounts, addBankAccount, getBankCards, addBankCard } from '../controllers/bankController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/names')
  .get(protect, getBankNames)
  .post(protect, authorize('admin', 'manager'), addBankName);

router.route('/accounts')
  .get(protect, getBankAccounts)
  .post(protect, authorize('admin', 'manager'), addBankAccount);

router.route('/cards')
  .get(protect, getBankCards)
  .post(protect, authorize('admin', 'manager'), addBankCard);

export default router;
