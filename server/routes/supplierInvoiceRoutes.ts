import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import { createSupplierInvoiceSchema, supplierPaymentSchema } from '../validators/catalogValidators';
import {
  createSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoices,
  paySupplierInvoice,
} from '../controllers/supplierInvoiceController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router
  .route('/')
  .get(getSupplierInvoices)
  .post(managers, validate({ body: createSupplierInvoiceSchema }), createSupplierInvoice);

router.post('/:id/payments', managers, validate({ params: idParam, body: supplierPaymentSchema }), paySupplierInvoice);
router.delete('/:id', managers, validate({ params: idParam }), deleteSupplierInvoice);

export default router;
