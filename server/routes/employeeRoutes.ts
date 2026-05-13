import express from 'express';
import { getEmployees, createEmployee } from '../controllers/employeeController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, authorize('admin', 'manager'), getEmployees)
  .post(protect, authorize('admin', 'manager'), createEmployee);

export default router;
