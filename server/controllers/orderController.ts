import { Request, Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, subtotal, totalVAT, discount, total, paymentMethod } = req.body;
    
    // Check stock availability only for items with a product reference
    for (const item of items) {
      if (!item.product) continue; // Skip manual/counter items
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

    // Auto deduct stock only for items with a product reference
    for (const item of items) {
      if (!item.product) continue;
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    const invoiceId = `REC-${Date.now()}`;
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
    const { month, year } = req.query;
    let query: any = { status: { $ne: 'voided' } };
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 1);
      query = {
        ...query,
        createdAt: {
        $gte: startDate,
        $lt: endDate
        }
      };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(successResponse(orders));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const deleteOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json(errorResponse('Order not found'));
      return;
    }
    if (order.status === 'voided') {
      res.status(400).json(errorResponse('Order is already voided'));
      return;
    }

    for (const item of order.items) {
      if (!item.product) continue;
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    order.status = 'voided';
    order.voidReason = String(req.query.reason || req.body?.reason || 'No reason provided').trim() || 'No reason provided';
    order.voidedAt = new Date();
    if (req.user?.id) order.voidedBy = req.user.id as any;
    await order.save();

    res.json(successResponse(order, 'Order voided successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const getVoidOrders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ status: 'voided' })
      .populate('voidedBy', 'name email role')
      .sort({ voidedAt: -1, createdAt: -1 })
      .limit(500);
    res.json(successResponse(orders));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
