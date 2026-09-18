import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import {
  createEmployeeDamageSchema,
  updateEmployeeDamageSchema,
} from '../validators/catalogValidators';
import {
  createEmployeeDamage,
  deleteEmployeeDamage,
  getEmployeeDamages,
  updateEmployeeDamage,
} from '../controllers/employeeDamageController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router
  .route('/')
  .get(getEmployeeDamages)
  .post(managers, validate({ body: createEmployeeDamageSchema }), createEmployeeDamage);

router
  .route('/:id')
  .patch(managers, validate({ params: idParam, body: updateEmployeeDamageSchema }), updateEmployeeDamage)
  .delete(managers, validate({ params: idParam }), deleteEmployeeDamage);

export default router;
