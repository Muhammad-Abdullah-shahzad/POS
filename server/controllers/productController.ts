import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';

// Ensure uploads directory exists — use process.cwd() for ts-node compatibility
const uploadDir = path.join(process.cwd(), 'uploads', 'products');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
console.log('Upload directory:', uploadDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, png, webp) are allowed'));
  }
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const query = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const products = await Product.find(query).limit(100);
    res.json(successResponse(products));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : null;
    // Parse numeric fields — they come as strings when sent via FormData
    const body = { ...req.body };
    if (typeof body.price === 'string') body.price = parseFloat(body.price);
    if (typeof body.costPrice === 'string') body.costPrice = parseFloat(body.costPrice);
    if (typeof body.vatRate === 'string') body.vatRate = parseFloat(body.vatRate);
    if (typeof body.stock === 'string') body.stock = parseInt(body.stock, 10);

    console.log('Creating product with body:', body); // debug log

    const product = await Product.create({ ...body, image: imageUrl });
    res.status(201).json(successResponse(product, 'Product created'));
  } catch (error: any) {
    console.error('Create product error:', error.message);
    // Return the actual validation message so client can show it
    const message = error?.errors
      ? Object.values(error.errors).map((e: any) => e.message).join(', ')
      : error.message;
    res.status(400).json(errorResponse(message));
  }
};

// JSON-only route (no image) - kept for compatibility
export const createProductJson = createProduct;

export const getProductByBarcode = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({ barcode: req.params.barcode });
    if (!product) {
      res.status(404).json(errorResponse('Product not found'));
      return;
    }
    res.json(successResponse(product));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!product) {
      res.status(404).json(errorResponse('Product not found'));
      return;
    }
    res.json(successResponse(product, 'Product updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const updateStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    if (typeof quantity !== 'number') {
      res.status(400).json(errorResponse('Quantity must be a number'));
      return;
    }
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { stock: quantity } },
      { new: true }
    );
    if (!product) {
      res.status(404).json(errorResponse('Product not found'));
      return;
    }
    res.json(successResponse(product, 'Stock updated successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      res.status(404).json(errorResponse('Product not found'));
      return;
    }
    // Delete image file if exists
    if (product.image) {
      const filePath = path.join(process.cwd(), product.image.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json(successResponse(null, 'Product deleted successfully'));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
