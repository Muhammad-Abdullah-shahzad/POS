import express from 'express';
import { 
  getCustomers, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer, 
  updateCustomerStats 
} from '../controllers/customerController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, getCustomers)
  .post(protect, createCustomer);

router.route('/:id')
  .put(protect, updateCustomer)
  .delete(protect, deleteCustomer);

router.post('/:id/transaction', protect, updateCustomerStats);

export default router;
