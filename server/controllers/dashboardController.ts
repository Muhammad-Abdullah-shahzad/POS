import { Request, Response } from 'express';
import Order from '../models/Order';
import Expense from '../models/Expense';
import Product from '../models/Product';
import { successResponse, errorResponse } from '../utils/response';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month } = req.query;
    let orderQuery: any = {};
    let expenseQuery: any = {};

    if (month && typeof month === 'string') {
      const startDate = new Date(`${month}-01T00:00:00.000Z`);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      orderQuery.createdAt = { $gte: startDate, $lte: endDate };
      expenseQuery.date = { $gte: startDate, $lte: endDate };
    }

    const orders = await Order.find(orderQuery);
    const expenses = await Expense.find(expenseQuery);

    const totalRevenue = orders.reduce((sum, order) => sum + (order.total - order.totalVAT), 0);
    const totalVATCollected = orders.reduce((sum, order) => sum + order.totalVAT, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    const lowStock = await Product.find({ stock: { $lte: 10 } })
      .select('name sku stock category')
      .sort({ stock: 1 })
      .limit(5);

    res.json(successResponse({
      totalRevenue,
      totalVATCollected,
      totalExpenses,
      netProfit,
      orderCount: orders.length,
      lowStock
    }));
  } catch (error: any) {
    res.status(500).json(errorResponse('Server Error', error.message));
  }
};
