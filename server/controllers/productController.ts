import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';
import { uploadToDrive, deleteFromDrive, extractDriveFileId } from '../utils/googleDrive';

// Temp directory for multer — files are uploaded here first, then pushed to Drive
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

export const upload = multer({ storage, fileFilter, limits: { fileSize: 15 * 1024 * 1024 } });

const localImageUrl = (file: Express.Multer.File): string => `/uploads/products/${file.filename}`;

const generatedSku = (): string => `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

// Upload to Drive after the product is already saved so image uploads never block product creation.
function promoteImageToDrive(
  productId: string,
  file: Express.Multer.File,
  oldImage?: string | null
): void {
  uploadToDrive(file.path, file.filename, file.mimetype)
    .then((driveUrl) => {
      if (oldImage) {
        const oldId = extractDriveFileId(oldImage);
        if (oldId) deleteFromDrive(oldId);
      }

      console.log('Drive backup upload success:', { productId, driveUrl });
    })
    .catch((driveErr: any) => {
      console.error('Google Drive upload failed, keeping local image:', driveErr.message);
    });
}

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
  console.log('=== createProduct called ===');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Has file:', !!req.file);
  console.log('Body keys:', Object.keys(req.body));
  try {
    let imageUrl: string | null = null;

    if (req.file) imageUrl = localImageUrl(req.file);

    // Parse numeric fields — they come as strings when sent via FormData
    const body = { ...req.body };
    if (typeof body.price === 'string')     body.price     = parseFloat(body.price);
    if (typeof body.costPrice === 'string') body.costPrice = parseFloat(body.costPrice);
    if (typeof body.vatRate === 'string')   body.vatRate   = parseFloat(body.vatRate);
    if (typeof body.stock === 'string')     body.stock     = parseInt(body.stock, 10);
    if (typeof body.drs === 'string')       body.drs       = parseFloat(body.drs);
    if (typeof body.sku === 'string')       body.sku       = body.sku.trim();

    console.log('Creating product with body:', JSON.stringify(body));

    const missingFields = ['name', 'barcode', 'category'].filter((field) => !body[field]);
    if (missingFields.length > 0) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json(errorResponse(`Missing required field(s): ${missingFields.join(', ')}`));
      return;
    }

    // Ensure required fields have defaults if missing
    if (body.vatRate === undefined || body.vatRate === null || isNaN(body.vatRate)) body.vatRate = 0;
    if (!body.vatType) body.vatType = 'exclusive';
    if (body.price === undefined || isNaN(body.price)) body.price = 0;
    if (body.costPrice === undefined || isNaN(body.costPrice)) body.costPrice = 0;
    if (body.stock === undefined || isNaN(body.stock)) body.stock = 0;
    if (body.drs === undefined || isNaN(body.drs)) body.drs = 0;
    if (!body.sku) body.sku = generatedSku();

    const product = await Product.create({ ...body, image: imageUrl });
    if (req.file) promoteImageToDrive(String(product._id), req.file);
    res.status(201).json(successResponse(product, 'Product created'));
  } catch (error: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Create product error:', error.message);
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      res.status(400).json(errorResponse(`A product with this ${field} already exists. Please use a unique SKU and barcode.`));
      return;
    }
    const message = error?.errors
      ? Object.values(error.errors).map((e: any) => e.message).join(', ')
      : error.message;
    res.status(400).json(errorResponse(message));
  }
};

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
    let updateData: any = { ...req.body };

    let previousImage: string | null = null;

    // If a new image file was uploaded, save it locally immediately.
    if (req.file) {
      const existing = await Product.findById(req.params.id);
      previousImage = existing?.image || null;
      updateData.image = localImageUrl(req.file);
    }

    // Parse numeric strings from FormData
    if (typeof updateData.price === 'string')     updateData.price     = parseFloat(updateData.price);
    if (typeof updateData.costPrice === 'string') updateData.costPrice = parseFloat(updateData.costPrice);
    if (typeof updateData.vatRate === 'string')   updateData.vatRate   = parseFloat(updateData.vatRate);
    if (typeof updateData.stock === 'string')     updateData.stock     = parseInt(updateData.stock, 10);
    if (typeof updateData.drs === 'string')       updateData.drs       = parseFloat(updateData.drs);
    if (typeof updateData.sku === 'string')       updateData.sku       = updateData.sku.trim();
    if (updateData.sku === '') delete updateData.sku;

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!product) {
      res.status(404).json(errorResponse('Product not found'));
      return;
    }
    if (req.file) promoteImageToDrive(String(product._id), req.file, previousImage);
    res.json(successResponse(product, 'Product updated successfully'));
  } catch (error: any) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      res.status(400).json(errorResponse(`A product with this ${field} already exists.`));
      return;
    }
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

    // Delete image from Google Drive if it's a Drive URL
    if (product.image) {
      const driveId = extractDriveFileId(product.image);
      if (driveId) {
        deleteFromDrive(driveId); // fire-and-forget
      } else {
        // Legacy local file — delete from disk
        const filePath = path.join(process.cwd(), product.image.replace(/^\//, ''));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    res.json(successResponse(null, 'Product deleted successfully'));
  } catch (error: any) {
    console.error('Delete product error:', error);
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
