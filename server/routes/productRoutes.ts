import express, { Request, Response, NextFunction } from 'express';
import { getProducts, createProduct, getProductByBarcode, updateStock, deleteProduct, upload } from '../controllers/productController';
import { protect, authorize } from '../middleware/auth';

const router = express.Router();

// Smart middleware: use multer only if multipart, else pass through to express.json
const smartUpload = (req: Request, res: Response, next: NextFunction) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.single('image')(req, res, (err) => {
      if (err) {
        res.status(400).json({ success: false, message: err.message });
        return;
      }
      next();
    });
  } else {
    next(); // JSON body already parsed by express.json()
  }
};

router.get('/', protect, getProducts);
router.post('/', protect, authorize('admin', 'manager'), smartUpload, createProduct);
router.get('/barcode/:barcode', protect, getProductByBarcode);
router.patch('/:id/stock', protect, authorize('admin', 'manager'), updateStock);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteProduct);

export default router;
