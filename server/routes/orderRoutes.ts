import express from 'express';
import { createOrder, getOrders, deleteOrder, getVoidOrders } from '../controllers/orderController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, getOrders)
  .post(protect, createOrder);

router.get('/voided', protect, getVoidOrders);
router.delete('/:id', protect, deleteOrder);

export default router;
