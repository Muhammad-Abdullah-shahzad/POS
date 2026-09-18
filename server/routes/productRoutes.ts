import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { idParam } from '../validators/common';
import {
  barcodeParam,
  createProductSchema,
  productSearchQuery,
  stockAdjustmentSchema,
  updateProductSchema,
} from '../validators/productValidators';
import { productImageUpload } from '../services/productImageService';
import {
  createProduct,
  deleteProduct,
  getProductByBarcode,
  getProducts,
  updateProduct,
  updateStock,
} from '../controllers/productController';

const router = Router();
const staff = authorize('admin', 'manager', 'cashier');

router.use(authenticate);

router
  .route('/')
  .get(validate({ query: productSearchQuery }), getProducts)
  // The image must be parsed before validation, because multipart form fields
  // only exist on the request once multer has read the stream.
  .post(staff, productImageUpload.single('image'), validate({ body: createProductSchema }), createProduct);

router.get('/barcode/:barcode', validate({ params: barcodeParam }), getProductByBarcode);

router.patch('/:id/stock', staff, validate({ params: idParam, body: stockAdjustmentSchema }), updateStock);

router
  .route('/:id')
  .patch(
    staff,
    productImageUpload.single('image'),
    validate({ params: idParam, body: updateProductSchema }),
    updateProduct
  )
  .delete(authorize('admin', 'manager'), validate({ params: idParam }), deleteProduct);

export default router;
