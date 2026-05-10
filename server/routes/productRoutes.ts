import express from 'express';
import { getProducts, createProduct, getProductByBarcode, updateStock } from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

router.route('/')
  .get(protect, getProducts)
  .post(protect, authorize('admin', 'manager'), createProduct);

router.get('/barcode/:barcode', protect, getProductByBarcode);
router.patch('/:id/stock', protect, authorize('admin', 'manager'), updateStock);

export default router;
