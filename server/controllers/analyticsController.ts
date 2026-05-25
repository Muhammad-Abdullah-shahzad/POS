import { Request, Response } from 'express';
import Order from '../models/Order';
import Expense from '../models/Expense';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';

// GET /api/analytics/revenue-trend?days=30
export const getRevenueTrend = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const orders = await Order.find({ createdAt: { $gte: startDate } });
    const expenses = await Expense.find({ date: { $gte: startDate } });

    // Build a map of date -> { revenue, expenses }
    const map: Record<string, { date: string; revenue: number; expenses: number; orders: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      map[key] = { date: key, revenue: 0, expenses: 0, orders: 0 };
    }

    for (const order of orders) {
      const key = (order.createdAt as Date).toISOString().slice(0, 10);
      if (map[key]) {
        map[key].revenue += order.total - order.totalVAT;
        map[key].orders += 1;
      }
    }

    for (const expense of expenses) {
      const key = new Date(expense.date).toISOString().slice(0, 10);
      if (map[key]) {
        map[key].expenses += expense.amount;
      }
    }

    res.json(successResponse(Object.values(map)));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

// GET /api/analytics/top-products?limit=10
export const getTopProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.name' },
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: 1,
          totalQty: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.json(successResponse(result));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

// GET /api/analytics/payment-methods
export const getPaymentMethodBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Order.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$total' },
        },
      },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          method: '$_id',
          count: 1,
          total: 1,
        },
      },
    ]);

    res.json(successResponse(result));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

// GET /api/analytics/expense-categories
export const getExpenseCategoryBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await Expense.aggregate([
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          category: '$_id',
          total: 1,
          count: 1,
        },
      },
    ]);

    res.json(successResponse(result));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};

// GET /api/analytics/monthly-summary?months=6
export const getMonthlySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const months = parseInt(req.query.months as string) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const orderAgg = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: { $subtract: ['$total', '$totalVAT'] } },
          vat: { $sum: '$totalVAT' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const expenseAgg = await Expense.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          expenses: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Merge into unified array
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const merged: Record<string, any> = {};

    for (const o of orderAgg) {
      const key = `${o._id.year}-${String(o._id.month).padStart(2, '0')}`;
      merged[key] = {
        month: `${monthNames[o._id.month - 1]} ${o._id.year}`,
        revenue: o.revenue,
        vat: o.vat,
        orders: o.orders,
        expenses: 0,
        profit: o.revenue,
      };
    }

    for (const e of expenseAgg) {
      const key = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
      if (!merged[key]) {
        merged[key] = {
          month: `${monthNames[e._id.month - 1]} ${e._id.year}`,
          revenue: 0,
          vat: 0,
          orders: 0,
          expenses: e.expenses,
          profit: -e.expenses,
        };
      } else {
        merged[key].expenses = e.expenses;
        merged[key].profit = merged[key].revenue - e.expenses;
      }
    }

    const result = Object.keys(merged).sort().map((k) => merged[k]);

    // Also include low stock products
    const lowStock = await Product.find({ stock: { $lte: 10 } })
      .select('name sku stock category')
      .sort({ stock: 1 })
      .limit(10);

    res.json(successResponse({ monthly: result, lowStock }));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
