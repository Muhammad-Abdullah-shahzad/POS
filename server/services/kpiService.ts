/**
 * Month-to-date KPIs for the admin dashboard.
 *
 * Every figure covers this month so far and is compared with the same stretch
 * of last month (the 1st up to today's date and time). Comparing the 5th of
 * this month with the whole of last month would show a fall every month, so
 * the comparison is like for like. A 30 day daily series feeds the sparklines.
 *
 * Every pipeline runs through the tenant plugin, so all figures belong to the
 * caller's company only.
 */
import type { PipelineStage } from 'mongoose';
import Customer from '../models/Customer';
import Expense from '../models/Expense';
import Order from '../models/Order';
import Product from '../models/Product';

export interface KpiTotals {
  /** Sales including VAT. */
  sales: number;
  orders: number;
  /** Cash taken, including the cash part of split payments. */
  cash: number;
  /** Card taken, including the card part of split payments. */
  card: number;
  expenses: number;
  /** Sales minus expenses. */
  profit: number;
  newCustomers: number;
}

export interface KpiDay extends KpiTotals {
  /** YYYY-MM-DD in the server's time zone. */
  date: string;
}

/** Detail behind the current period's totals, for the dashboard's drill-down views. */
export interface KpiBreakdown {
  payments: {
    cashOrders: number;
    /** Paid fully in cash. */
    cashOnly: number;
    cardOrders: number;
    /** Paid fully by card. */
    cardOnly: number;
    splitOrders: number;
    splitCash: number;
    splitCard: number;
  };
  expenseCategories: { category: string; total: number; count: number }[];
  expenseCount: number;
  /** Best sellers by revenue before discounts, as on the Analysis page. */
  topProducts: { name: string; quantity: number; revenue: number }[];
  /** Products at or under the low stock threshold, emptiest first. */
  lowStockItems: { name: string; category: string; stock: number; price: number }[];
}

export interface DashboardKpis {
  current: KpiTotals;
  previous: KpiTotals;
  /** The last 30 days, oldest first, one entry per day. */
  daily: KpiDay[];
  breakdown: KpiBreakdown;
  /** Snapshot counts that have no month-on-month comparison. */
  catalogue: { products: number; lowStock: number; outOfStock: number; categories: number; customers: number };
  periods: { currentFrom: string; previousFrom: string; previousTo: string; generatedAt: string };
}

export const SERIES_DAYS = 30;
export const LOW_STOCK_THRESHOLD = 10;
const TOP_PRODUCTS = 6;
const LOW_STOCK_LIST = 100;

/** Day keys follow the server clock, the same clock the month windows use. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface KpiWindows {
  currentFrom: Date;
  previousFrom: Date;
  previousTo: Date;
  seriesFrom: Date;
}

export function kpiWindows(now = new Date()): KpiWindows {
  const currentFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // The 31st has no match in a 30 day month, so the day is clamped.
  const daysInPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const previousTo = new Date(
    previousFrom.getFullYear(),
    previousFrom.getMonth(),
    Math.min(now.getDate(), daysInPreviousMonth),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds()
  );
  const seriesFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SERIES_DAYS - 1));

  return { currentFrom, previousFrom, previousTo, seriesFrom };
}

const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const round2 = (value: number): number => Math.round(value * 100) / 100;

type Range = { $gte: Date; $lt?: Date };

// ── Orders ───────────────────────────────────────────────────────────────────

const withPaymentMethod: PipelineStage = {
  $addFields: { method: { $toLower: { $ifNull: ['$paymentMethod', ''] } } },
};

const isSplit = { $regexMatch: { input: '$method', regex: '^split' } };

/** Sums shared by the period totals and the daily series. */
const salesAccumulators = {
  sales: { $sum: '$total' },
  orders: { $sum: 1 },
  cash: {
    $sum: {
      $cond: [{ $eq: ['$method', 'cash'] }, '$total', { $cond: [isSplit, { $ifNull: ['$splitCash', 0] }, 0] }],
    },
  },
  card: {
    $sum: {
      $cond: [{ $eq: ['$method', 'card'] }, '$total', { $cond: [isSplit, { $ifNull: ['$splitCard', 0] }, 0] }],
    },
  },
};

interface SalesRow {
  _id: string | null;
  sales: number;
  orders: number;
  cash: number;
  card: number;
}

function salesPipeline(range: Range, byDay: boolean): PipelineStage[] {
  return [
    { $match: { status: { $ne: 'voided' }, createdAt: range } },
    withPaymentMethod,
    {
      $group: {
        _id: byDay ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } } : null,
        ...salesAccumulators,
      },
    },
  ];
}

interface PaymentRow {
  _id: 'cash' | 'card' | 'split' | 'other';
  orders: number;
  total: number;
  splitCash: number;
  splitCard: number;
}

function paymentPipeline(range: Range): PipelineStage[] {
  return [
    { $match: { status: { $ne: 'voided' }, createdAt: range } },
    withPaymentMethod,
    {
      $group: {
        _id: {
          $switch: {
            branches: [
              { case: { $eq: ['$method', 'cash'] }, then: 'cash' },
              { case: { $eq: ['$method', 'card'] }, then: 'card' },
              { case: isSplit, then: 'split' },
            ],
            default: 'other',
          },
        },
        orders: { $sum: 1 },
        total: { $sum: '$total' },
        splitCash: { $sum: { $ifNull: ['$splitCash', 0] } },
        splitCard: { $sum: { $ifNull: ['$splitCard', 0] } },
      },
    },
  ];
}

function topProductsPipeline(range: Range): PipelineStage[] {
  return [
    { $match: { status: { $ne: 'voided' }, createdAt: range } },
    { $unwind: '$items' },
    {
      $group: {
        _id: { $ifNull: ['$items.product', '$items.name'] },
        name: { $first: '$items.name' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.totalPrice' },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: TOP_PRODUCTS },
  ];
}

// ── Expenses and customers ───────────────────────────────────────────────────

function expensePipeline(range: Range, byDay: boolean): PipelineStage[] {
  return [
    { $match: { date: range } },
    {
      $group: {
        _id: byDay ? { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TIME_ZONE } } : null,
        total: { $sum: '$amount' },
      },
    },
  ];
}

function expenseCategoryPipeline(range: Range): PipelineStage[] {
  return [
    { $match: { date: range } },
    { $group: { _id: { $ifNull: ['$category', 'Other'] }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ];
}

function customerPipeline(range: Range): PipelineStage[] {
  return [
    { $match: { createdAt: range } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } },
        count: { $sum: 1 },
      },
    },
  ];
}

function toTotals(sales: Partial<SalesRow> | undefined, expenses: number, newCustomers: number): KpiTotals {
  const salesTotal = sales?.sales ?? 0;
  return {
    sales: round2(salesTotal),
    orders: sales?.orders ?? 0,
    cash: round2(sales?.cash ?? 0),
    card: round2(sales?.card ?? 0),
    expenses: round2(expenses),
    profit: round2(salesTotal - expenses),
    newCustomers,
  };
}

export async function computeKpis(now = new Date()): Promise<DashboardKpis> {
  const windows = kpiWindows(now);
  const current: Range = { $gte: windows.currentFrom };
  const previous: Range = { $gte: windows.previousFrom, $lt: windows.previousTo };
  const series: Range = { $gte: windows.seriesFrom };

  const [
    [currentSales],
    [previousSales],
    [currentExpenses],
    [previousExpenses],
    currentCustomers,
    previousCustomers,
    dailySales,
    dailyExpenses,
    dailyCustomers,
    products,
    lowStock,
    outOfStock,
    categories,
    customers,
    payments,
    expenseCategories,
    topProducts,
    lowStockItems,
  ] = await Promise.all([
    Order.aggregate<SalesRow>(salesPipeline(current, false)),
    Order.aggregate<SalesRow>(salesPipeline(previous, false)),
    Expense.aggregate<{ total: number }>(expensePipeline(current, false)),
    Expense.aggregate<{ total: number }>(expensePipeline(previous, false)),
    Customer.countDocuments({ createdAt: current }),
    Customer.countDocuments({ createdAt: previous }),
    Order.aggregate<SalesRow>(salesPipeline(series, true)),
    Expense.aggregate<{ _id: string; total: number }>(expensePipeline(series, true)),
    Customer.aggregate<{ _id: string; count: number }>(customerPipeline(series)),
    Product.countDocuments(),
    Product.countDocuments({ stock: { $lte: LOW_STOCK_THRESHOLD } }),
    Product.countDocuments({ stock: { $lte: 0 } }),
    Product.distinct('category'),
    Customer.countDocuments(),
    Order.aggregate<PaymentRow>(paymentPipeline(current)),
    Expense.aggregate<{ _id: string; total: number; count: number }>(expenseCategoryPipeline(current)),
    Order.aggregate<{ name: string; quantity: number; revenue: number }>(topProductsPipeline(current)),
    Product.find({ stock: { $lte: LOW_STOCK_THRESHOLD } })
      .select('name category stock price')
      .sort({ stock: 1, name: 1 })
      .limit(LOW_STOCK_LIST)
      .lean(),
  ]);

  const byKind = new Map(payments.map((row) => [row._id, row]));

  const salesByDay = new Map(dailySales.map((row) => [row._id as string, row]));
  const expensesByDay = new Map(dailyExpenses.map((row) => [row._id, row.total]));
  const customersByDay = new Map(dailyCustomers.map((row) => [row._id, row.count]));

  // Days without activity still need a point, or the sparkline would skip them.
  const daily: KpiDay[] = Array.from({ length: SERIES_DAYS }, (_, offset) => {
    const day = new Date(windows.seriesFrom.getFullYear(), windows.seriesFrom.getMonth(), windows.seriesFrom.getDate() + offset);
    const key = localDayKey(day);
    return {
      date: key,
      ...toTotals(salesByDay.get(key), expensesByDay.get(key) ?? 0, customersByDay.get(key) ?? 0),
    };
  });

  return {
    current: toTotals(currentSales, currentExpenses?.total ?? 0, currentCustomers),
    previous: toTotals(previousSales, previousExpenses?.total ?? 0, previousCustomers),
    daily,
    breakdown: {
      payments: {
        cashOrders: byKind.get('cash')?.orders ?? 0,
        cashOnly: round2(byKind.get('cash')?.total ?? 0),
        cardOrders: byKind.get('card')?.orders ?? 0,
        cardOnly: round2(byKind.get('card')?.total ?? 0),
        splitOrders: byKind.get('split')?.orders ?? 0,
        splitCash: round2(byKind.get('split')?.splitCash ?? 0),
        splitCard: round2(byKind.get('split')?.splitCard ?? 0),
      },
      expenseCategories: expenseCategories.map((row) => ({ category: row._id, total: round2(row.total), count: row.count })),
      expenseCount: expenseCategories.reduce((sum, row) => sum + row.count, 0),
      topProducts: topProducts.map(({ name, quantity, revenue }) => ({ name, quantity, revenue: round2(revenue) })),
      lowStockItems: lowStockItems.map(({ name, category, stock, price }) => ({ name, category, stock, price })),
    },
    catalogue: { products, lowStock, outOfStock, categories: categories.filter(Boolean).length, customers },
    periods: {
      currentFrom: windows.currentFrom.toISOString(),
      previousFrom: windows.previousFrom.toISOString(),
      previousTo: windows.previousTo.toISOString(),
      generatedAt: now.toISOString(),
    },
  };
}
