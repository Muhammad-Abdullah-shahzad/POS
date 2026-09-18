import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/catalogValidators';
import {
  createEmployee,
  deleteEmployee,
  getEmployees,
  updateEmployee,
} from '../controllers/employeeController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router.route('/').get(getEmployees).post(managers, validate({ body: createEmployeeSchema }), createEmployee);

router
  .route('/:id')
  .put(managers, validate({ params: idParam, body: updateEmployeeSchema }), updateEmployee)
  .delete(managers, validate({ params: idParam }), deleteEmployee);

export default router;
