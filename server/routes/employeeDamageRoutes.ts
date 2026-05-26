import express from 'express';
import {
  getEmployeeDamages,
  createEmployeeDamage,
  updateEmployeeDamage,
  deleteEmployeeDamage,
} from '../controllers/employeeDamageController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager', 'cashier'), getEmployeeDamages)
  .post(protect, authorize('admin', 'manager'), createEmployeeDamage);

router.route('/:id')
  .patch(protect, authorize('admin', 'manager'), updateEmployeeDamage)
  .delete(protect, authorize('admin', 'manager'), deleteEmployeeDamage);

export default router;
