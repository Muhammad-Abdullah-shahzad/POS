import express, { Request, Response, NextFunction } from 'express';
import {
  getProducts,
  createProduct,
  getProductByBarcode,
  updateProduct,
  updateStock,
  deleteProduct,
  upload,
} from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

const productUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err.message);
      res.status(400).json({ success: false, data: null, message: err.message });
      return;
    }

    console.log('Product upload parsed:', {
      contentType: req.headers['content-type'],
      file: req.file?.filename || null,
      bodyKeys: Object.keys(req.body || {}),
    });
    next();
  });
};

router.get('/', protect, getProducts);
router.post('/', protect, authorize('admin', 'manager', 'cashier'), productUpload, createProduct);
router.get('/barcode/:barcode', protect, getProductByBarcode);
router.patch('/:id/stock', protect, authorize('admin', 'manager'), updateStock);
router.patch('/:id', protect, authorize('admin', 'manager'), productUpload, updateProduct);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteProduct);

export default router;
