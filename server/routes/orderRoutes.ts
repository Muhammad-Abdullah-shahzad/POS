import express from 'express';
import { createOrder, getOrders } from '../controllers/orderController';
import { protect } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, getOrders)
  .post(protect, createOrder);

export default router;
