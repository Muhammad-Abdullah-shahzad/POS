import { Request, Response } from 'express';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string;
    const query = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const products = await Product.find(query).limit(100); // Limit for POS performance
    res.json(successResponse(products));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(successResponse(product, 'Product created'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

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
