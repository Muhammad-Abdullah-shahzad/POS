import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, subtotal, totalVAT, discount, total, paymentMethod } = req.body;
    
    // Check stock availability for all items first
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        res.status(404).json(errorResponse(`Product ${item.name} not found`));
        return;
      }
      if (product.stock < item.quantity) {
        res.status(400).json(errorResponse(`Insufficient stock for ${item.name}. Available: ${product.stock}`));
        return;
      }
    }

    // Auto deduct stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    const invoiceId = `INV-${Date.now()}`;
    const order = await Order.create({
      invoiceId,
      items,
      subtotal,
      totalVAT,
      discount,
      total,
      paymentMethod
    });

    res.status(201).json(successResponse(order, 'Order completed'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
    res.json(successResponse(orders));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
