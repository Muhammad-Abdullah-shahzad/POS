import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import Expense from '../models/Expense';
import Order from '../models/Order';
import Product from '../models/Product';

const LOW_STOCK_THRESHOLD = 10;

/** Start and end of a calendar month given as `YYYY-MM`. */
function monthRange(month: string): { start: Date; end: Date } {
  const [year, monthIndex] = month.split('-').map(Number);
  return {
    start: new Date(year, monthIndex - 1, 1),
    end: new Date(year, monthIndex, 1),
  };
}

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const month = req.validatedQuery?.month as string | undefined;
  const range = month ? monthRange(month) : null;
  const period = range ? { $gte: range.start, $lt: range.end } : undefined;

  const [totals, expenseTotals, lowStock] = await Promise.all([
    // Voided orders are excluded: the money was handed back.
    Order.aggregate([
      { $match: { status: { $ne: 'voided' }, ...(period && { createdAt: period }) } },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $subtract: ['$total', '$totalVAT'] } },
          vat: { $sum: '$totalVAT' },
          orderCount: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { ...(period && { date: period }) } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
      .select('name sku stock category')
      .sort({ stock: 1 })
      .limit(5),
  ]);

  const totalRevenue = totals[0]?.revenue ?? 0;
  const totalExpenses = expenseTotals[0]?.total ?? 0;

  res.json(
    successResponse({
      totalRevenue,
      totalVATCollected: totals[0]?.vat ?? 0,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      orderCount: totals[0]?.orderCount ?? 0,
      lowStock,
    })
  );
});
