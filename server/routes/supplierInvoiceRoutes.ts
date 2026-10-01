import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import {
  createSupplierInvoiceSchema,
  legacySupplierPaymentParams,
  paySupplierSchema,
  supplierPaymentParams,
  supplierPaymentSchema,
  updateSupplierInvoiceSchema,
  updateSupplierPaymentSchema,
} from '../validators/catalogValidators';
import {
  createSupplierInvoice,
  deleteSupplierInvoice,
  getSupplierInvoices,
  paySupplierAccount,
  paySupplierInvoice,
  updateLegacySupplierPayment,
  updateSupplierInvoice,
  updateSupplierPayment,
} from '../controllers/supplierInvoiceController';

const router = Router();
const managers = authorize('admin', 'manager');

router.use(authenticate);

router
  .route('/')
  .get(getSupplierInvoices)
  .post(managers, validate({ body: createSupplierInvoiceSchema }), createSupplierInvoice);

// Pays the supplier, clearing their oldest invoices first.
router.post('/pay-supplier', managers, validate({ body: paySupplierSchema }), paySupplierAccount);
router.post('/:id/payments', managers, validate({ params: idParam, body: supplierPaymentSchema }), paySupplierInvoice);
router.delete('/:id', managers, validate({ params: idParam }), deleteSupplierInvoice);

// Corrections from the ledger statement.
router.patch('/payments/:paymentId', managers, validate({ params: supplierPaymentParams, body: updateSupplierPaymentSchema }), updateSupplierPayment);
router.patch('/:id/payments/:index', managers, validate({ params: legacySupplierPaymentParams, body: updateSupplierPaymentSchema }), updateLegacySupplierPayment);
router.patch('/:id', managers, validate({ params: idParam, body: updateSupplierInvoiceSchema }), updateSupplierInvoice);

export default router;
