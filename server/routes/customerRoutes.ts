import express from 'express';
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer, 
  updateCustomerStats,
  resetLoyaltyPoints
} from '../controllers/customerController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(getCustomers)
  .post(protect, createCustomer);

router.route('/:id')
  .put(protect, updateCustomer)
  .delete(protect, deleteCustomer);

router.post('/:id/transaction', protect, updateCustomerStats);
router.post('/:id/reset-points', protect, resetLoyaltyPoints);

export default router;
