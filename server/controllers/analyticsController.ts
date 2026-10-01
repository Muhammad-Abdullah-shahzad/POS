/**
 * Reporting aggregates.
 *
 * Every pipeline is filtered to the caller's company before it runs — the
 * tenant plugin prepends the `$match` — so a report can never pull in another
 * shop's takings. Voided orders are excluded throughout.
 */
import { Request, Response } from 'express';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import CustomerPayment from '../models/CustomerPayment';
import Expense from '../models/Expense';
import Order from '../models/Order';
import Product from '../models/Product';
import ProductReturn from '../models/ProductReturn';
import { computeKpis } from '../services/kpiService';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const completedOrders = { status: { $ne: 'voided' } };

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

function startOfDaysAgo(days: number): Date {
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

// GET /api/analytics/revenue-trend?days=30
export const getRevenueTrend = asyncHandler(async (req: Request, res: Response) => {
  const days = (req.validatedQuery?.days as number) ?? 30;
  const startDate = startOfDaysAgo(days);

  const [orders, custPayments, expenses] = await Promise.all([
    Order.aggregate([
      { $match: { ...completedOrders, paymentMethod: { $ne: 'credit' }, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: { $subtract: ['$total', '$totalVAT'] } },
          orders: { $sum: 1 },
        },
      },
    ]),
    CustomerPayment.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amountPaid' },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          expenses: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const revenueByDay = new Map(orders.map((row) => [row._id, row]));
  const duesByDay = new Map(custPayments.map((row) => [row._id, row.revenue as number]));
  const expensesByDay = new Map(expenses.map((row) => [row._id, row.expenses as number]));

  // Days with no activity still need a point, or the chart draws gaps.
  const trend = Array.from({ length: days }, (_, offset) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    const key = dayKey(date);

    const orderRev = revenueByDay.get(key)?.revenue ?? 0;
    const duesRev = duesByDay.get(key) ?? 0;

    return {
      date: key,
      revenue: Math.round((orderRev + duesRev) * 100) / 100,
      orders: revenueByDay.get(key)?.orders ?? 0,
      expenses: expensesByDay.get(key) ?? 0,
    };
  });

  res.json(successResponse(trend));
});

// GET /api/analytics/top-products?limit=10
export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const limit = (req.validatedQuery?.limit as number) ?? 10;

  const result = await Order.aggregate([
    { $match: completedOrders },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        totalQty: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.totalPrice' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productInfo',
      }
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, productId: '$_id', name: 1, totalQty: 1, totalRevenue: 1, product: '$productInfo' } },
  ]);

  // Best sellers net of what came back.
  const returned = await ProductReturn.aggregate<{ _id: string; quantity: number; refunded: number }>([
    { $unwind: '$items' },
    { $group: { _id: { $toString: '$items.product' }, quantity: { $sum: '$items.quantity' }, refunded: { $sum: '$items.total' } } },
  ]);
  const back = new Map(returned.map((row) => [row._id, row]));
  const net = result
    .map((row) => {
      const came = back.get(String(row.productId));
      return { ...row, totalQty: row.totalQty - (came?.quantity ?? 0), totalRevenue: Math.round((row.totalRevenue - (came?.refunded ?? 0)) * 100) / 100 };
    })
    .filter((row) => row.totalQty > 0 || row.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);

  res.json(successResponse(net));
});

// GET /api/analytics/payment-methods
export const getPaymentMethodBreakdown = asyncHandler(async (_req: Request, res: Response) => {
  const result = await Order.aggregate([
    { $match: completedOrders },
    { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$total' } } },
    { $sort: { total: -1 } },
    { $project: { _id: 0, method: '$_id', count: 1, total: 1 } },
  ]);

  res.json(successResponse(result));
});

// GET /api/analytics/expense-categories
export const getExpenseCategoryBreakdown = asyncHandler(async (_req: Request, res: Response) => {
  const result = await Expense.aggregate([
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $project: { _id: 0, category: '$_id', total: 1, count: 1 } },
  ]);

  res.json(successResponse(result));
});

// GET /api/analytics/monthly-summary?months=6
export const getMonthlySummary = asyncHandler(async (req: Request, res: Response) => {
  const months = (req.validatedQuery?.months as number) ?? 6;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months + 1);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const monthBucket = (field: string) => ({ year: { $year: field }, month: { $month: field } });

  const [orderRows, paymentRows, expenseRows, lowStock, returnRows] = await Promise.all([
    Order.aggregate([
      { $match: { ...completedOrders, paymentMethod: { $ne: 'credit' }, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: monthBucket('$createdAt'),
          revenue: { $sum: { $subtract: ['$total', '$totalVAT'] } },
          vat: { $sum: '$totalVAT' },
          orders: { $sum: 1 },
        },
      },
    ]),
    CustomerPayment.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: monthBucket('$createdAt'), revenue: { $sum: '$amountPaid' } } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: startDate } } },
      { $group: { _id: monthBucket('$date'), expenses: { $sum: '$amount' } } },
    ]),
    Product.find({ stock: { $lte: 10 } }).select('name sku stock category').sort({ stock: 1 }).limit(10),
    // Refunds paid out in cash or by card are money leaving the business that month.
    ProductReturn.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: monthBucket('$createdAt'),
          refunds: { $sum: { $add: [{ $ifNull: ['$refundCash', 0] }, { $ifNull: ['$refundCard', 0] }] } },
          returns: { $sum: 1 },
        },
      },
    ]),
  ]);

  const bucketKey = (row: { _id: { year: number; month: number } }) =>
    `${row._id.year}-${String(row._id.month).padStart(2, '0')}`;

  const summary = new Map<
    string,
    { month: string; revenue: number; vat: number; orders: number; expenses: number; profit: number; refunds: number; returns: number }
  >();

  for (const row of orderRows) {
    summary.set(bucketKey(row), {
      month: `${MONTH_NAMES[row._id.month - 1]} ${row._id.year}`,
      revenue: row.revenue,
      vat: row.vat,
      orders: row.orders,
      expenses: 0,
      profit: row.revenue,
      refunds: 0,
      returns: 0,
    });
  }

  for (const row of paymentRows) {
    const key = bucketKey(row);
    const existing = summary.get(key);
    if (existing) {
      existing.revenue += row.revenue;
      existing.profit += row.revenue;
    } else {
      summary.set(key, {
        month: `${MONTH_NAMES[row._id.month - 1]} ${row._id.year}`,
        revenue: row.revenue,
        vat: 0,
        orders: 0,
        expenses: 0,
        profit: row.revenue,
        refunds: 0,
        returns: 0,
      });
    }
  }

  for (const row of expenseRows) {
    const key = bucketKey(row);
    const existing = summary.get(key);

    if (existing) {
      existing.expenses = row.expenses;
      existing.profit = existing.revenue - row.expenses;
    } else {
      summary.set(key, {
        month: `${MONTH_NAMES[row._id.month - 1]} ${row._id.year}`,
        revenue: 0,
        vat: 0,
        orders: 0,
        expenses: row.expenses,
        profit: -row.expenses,
        refunds: 0,
        returns: 0,
      });
    }
  }

  for (const row of returnRows) {
    const key = bucketKey(row);
    const month =
      summary.get(key) ??
      { month: `${MONTH_NAMES[row._id.month - 1]} ${row._id.year}`, revenue: 0, vat: 0, orders: 0, expenses: 0, profit: 0, refunds: 0, returns: 0 };
    month.revenue -= row.refunds;
    month.profit -= row.refunds;
    month.refunds = row.refunds;
    month.returns = row.returns;
    summary.set(key, month);
  }

  const monthly = [...summary.keys()].sort().map((key) => summary.get(key)!);

  res.json(successResponse({ monthly, lowStock }));
});

// GET /api/analytics/kpis
export const getKpis = asyncHandler(async (req: Request, res: Response) => {
  const period = req.validatedQuery?.period === 'day' ? 'day' : 'month';
  res.json(successResponse(await computeKpis(new Date(), period)));
});
