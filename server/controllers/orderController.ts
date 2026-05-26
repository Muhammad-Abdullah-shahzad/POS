import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

type NormalizedOrderItem = {
  product?: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  vatRate: number;
  vatAmount: number;
  totalPrice: number;
  discountPct?: number;
  discountAmt?: number;
  finalPrice?: number;
  drs?: number;
};

const normalizeOrderItems = (items: any[]): NormalizedOrderItem[] => {
  return (items || []).map((item: any) => {
    const productId = item.product || item.productId;
    const product = productId && mongoose.Types.ObjectId.isValid(productId)
      ? new mongoose.Types.ObjectId(productId)
      : undefined;

    return {
      ...item,
      product,
      quantity: Number(item.quantity),
      price: Number(item.price),
      vatRate: Number(item.vatRate) || 0,
      vatAmount: Number(item.vatAmount) || 0,
      totalPrice: Number(item.totalPrice),
      discountPct: Number(item.discountPct) || 0,
      discountAmt: Number(item.discountAmt) || 0,
      finalPrice: Number(item.finalPrice) || Number(item.totalPrice),
      drs: Number(item.drs) || 0,
    };
  });
};

const getProductQuantities = (items: NormalizedOrderItem[]): Map<string, { quantity: number; name: string }> => {
  return items.reduce((totals, item) => {
    if (!item.product) return totals;
    const productId = item.product.toString();
    const existing = totals.get(productId);
    totals.set(productId, {
      quantity: (existing?.quantity || 0) + item.quantity,
      name: existing?.name || item.name,
    });
    return totals;
  }, new Map<string, { quantity: number; name: string }>());
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const deductedStock = new Map<string, number>();

  try {
    const { items, subtotal, totalVAT, discount, totalDRS, total, paymentMethod, splitCash, splitCard } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json(errorResponse('Order must contain at least one item'));
      return;
    }

    const normalizedItems = normalizeOrderItems(items);

    for (const item of normalizedItems) {
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        res.status(400).json(errorResponse(`Invalid quantity for ${item.name || 'item'}`));
        return;
      }

      if (!Number.isFinite(item.price) || !Number.isFinite(item.totalPrice)) {
        res.status(400).json(errorResponse(`Invalid price for ${item.name || 'item'}`));
        return;
      }
    }

    const productQuantities = getProductQuantities(normalizedItems);

    for (const [productId, item] of productQuantities) {
      const updatedProduct = await Product.findOneAndUpdate({
        _id: productId,
        stock: { $gte: item.quantity },
      }, {
        $inc: { stock: -item.quantity },
      }, {
        new: true,
      });

      if (!updatedProduct) {
        const product = await Product.findById(productId).select('name stock');
        const available = product?.stock ?? 0;
        throw new Error(`Insufficient stock for ${product?.name || item.name}. Available: ${available}`);
      }

      deductedStock.set(productId, item.quantity);
    }

    const invoiceId = `REC-${Date.now()}`;
    const order = await Order.create({
      invoiceId,
      items: normalizedItems,
      subtotal,
      totalVAT,
      discount,
      totalDRS: totalDRS || 0,
      total,
      paymentMethod,
      ...(splitCash != null && { splitCash: Number(splitCash) }),
      ...(splitCard != null && { splitCard: Number(splitCard) }),
      ...(req.body.customerId && { customerId: req.body.customerId }),
      ...(req.body.customerName && { customerName: req.body.customerName }),
    });

    const activeOrdersCount = await Order.countDocuments({ status: { $ne: 'voided' } });
    const orderObj = order.toObject();
    orderObj.invoiceId = String(activeOrdersCount);

    res.status(201).json(successResponse(orderObj, 'Order completed'));
  } catch (error: any) {
    if (deductedStock.size > 0) {
      for (const [productId, quantity] of deductedStock) {
        await Product.findByIdAndUpdate(productId, { $inc: { stock: quantity } });
      }
    }

    const status = error.message?.startsWith('Insufficient stock') ? 400 : 400;
    res.status(status).json(errorResponse(error.message || 'Bad Request'));
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
    
    // Map order _ids to their global chronological sequence number among all active orders
    const allActiveOrders = await Order.find({ status: { $ne: 'voided' } }).sort({ createdAt: 1 }).select('_id');
    const orderIdToSeqMap = new Map<string, number>();
    allActiveOrders.forEach((o, index) => {
      orderIdToSeqMap.set(o._id.toString(), index + 1);
    });

    const mappedOrders = orders.map(order => {
      const obj = order.toObject();
      const seq = orderIdToSeqMap.get(order._id.toString()) || 1;
      obj.invoiceId = String(seq);
      return obj;
    });

    res.json(successResponse(mappedOrders));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

export const deleteOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'voided' } },
      {
        $set: {
          status: 'voided',
          voidReason: String(req.query.reason || req.body?.reason || 'No reason provided').trim() || 'No reason provided',
          voidedAt: new Date(),
          ...(req.user?.id && { voidedBy: req.user.id }),
          ...(String(req.query.employeeId || req.body?.employeeId || '').trim() && {
            voidedByEmployee: String(req.query.employeeId || req.body?.employeeId || '').trim(),
          }),
          ...(String(req.query.employeeName || req.body?.employeeName || '').trim() && {
            voidedByEmployeeName: String(req.query.employeeName || req.body?.employeeName || '').trim(),
          }),
        },
      },
      { new: false }
    );

    if (!order) {
      const existingOrder = await Order.findById(req.params.id).select('status');
      res.status(existingOrder?.status === 'voided' ? 400 : 404).json(errorResponse(existingOrder?.status === 'voided' ? 'Order is already voided' : 'Order not found'));
      return;
    }

    const productQuantities = getProductQuantities(order.items as NormalizedOrderItem[]);
    for (const [productId, item] of productQuantities) {
      await Product.findByIdAndUpdate(productId, {
        $inc: { stock: item.quantity },
      });
    }

    const voidedOrder = await Order.findById(req.params.id);
    res.json(successResponse(voidedOrder, 'Order voided successfully'));
  } catch (error: any) {
    res.status(400).json(errorResponse('Bad Request', error.message));
  }
};

export const getVoidOrders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orders = await Order.find({ status: 'voided' })
      .populate('voidedBy', 'name email role')
      .populate('voidedByEmployee', 'name role emailId')
      .sort({ voidedAt: -1, createdAt: -1 })
      .limit(500);
    res.json(successResponse(orders));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
