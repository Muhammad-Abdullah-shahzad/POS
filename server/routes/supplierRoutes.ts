import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createSupplierSchema, searchQuery, updateSupplierSchema } from '../validators/catalogValidators';
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from '../controllers/supplierController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router
  .route('/')
  .get(validate({ query: searchQuery }), getSuppliers)
  .post(managers, validate({ body: createSupplierSchema }), createSupplier);

router
  .route('/:id')
  .patch(managers, validate({ params: idParam, body: updateSupplierSchema }), updateSupplier)
  .delete(managers, validate({ params: idParam }), deleteSupplier);

export default router;
