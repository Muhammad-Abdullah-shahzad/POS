import express from 'express';
import { getEmployees, createEmployee, deleteEmployee, updateEmployee } from '../controllers/employeeController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager', 'cashier'), getEmployees)
  .post(protect, authorize('admin', 'manager'), createEmployee);

router.route('/:id')
  .put(protect, authorize('admin', 'manager'), updateEmployee)
  .delete(protect, authorize('admin', 'manager'), deleteEmployee);

export default router;
