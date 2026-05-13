import express from 'express';
import { getSuppliers, createSupplier } from '../controllers/supplierController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, getSuppliers)
  .post(protect, authorize('admin', 'manager'), createSupplier);

export default router;
