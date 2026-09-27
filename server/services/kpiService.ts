/**
 * Month-to-date KPIs for the admin dashboard.
 *
 * Every figure covers this month so far and is compared with the same stretch
 * of last month (the 1st up to today's date and time). Comparing the 5th of
 * this month with the whole of last month would show a fall every month, so
 * the comparison is like for like. A 30 day daily series feeds the sparklines.
 *
 * Realized Revenue & Cash Drawer Reconciliation:
 * - Realized revenue equals physical money received into the business (Cash + Card).
 * - Credit sales (uncollected debt) do NOT increase revenue until paid.
 * - Customer debt repayments (CustomerPayment) DO increase cash/card and revenue
 *   when received, matching real money in the till/bank.
 *
 * Every pipeline runs through the tenant plugin, so all figures belong to the
 * caller's company only.
 */
import type { PipelineStage } from 'mongoose';
import Customer from '../models/Customer';
import CustomerPayment from '../models/CustomerPayment';
import Expense from '../models/Expense';
import Order from '../models/Order';
import Product from '../models/Product';

export interface KpiTotals {
  /** Realized sales/revenue (money received in drawer & bank). */
  sales: number;
  orders: number;
  /** Cash taken, including cash orders, cash part of split, and cash customer dues payments. */
  cash: number;
  /** Card taken, including card orders, card part of split, and card customer dues payments. */
  card: number;
  expenses: number;
  /** Realized sales minus expenses. */
  profit: number;
  newCustomers: number;
  /** Dues collected from customers this period. */
  duesCollected?: number;
  /** Credit sales issued (uncollected). */
  creditSales?: number;
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
    creditOrders: number;
    /** What went on customer accounts (credit sales, less any deposits). */
    creditOnly: number;
    /** Cash and card deposits taken on credit sales. */
    creditDepositCash: number;
    creditDepositCard: number;
    duesOrders: number;
    duesCash: number;
    duesCard: number;
    duesTotal: number;
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
const isCredit = { $eq: ['$method', 'credit'] };

/**
 * Orders saved since the till began recording how each sale was settled carry
 * paidCash, paidCard and creditAmount, which add up to the total. Older orders
 * have none of them, or zeros where a till added the columns later, and are
 * read from their payment method as before.
 */
const recordedSettlement = {
  $add: [{ $ifNull: ['$paidCash', 0] }, { $ifNull: ['$paidCard', 0] }, { $ifNull: ['$creditAmount', 0] }],
};
const isSettled = { $gt: [recordedSettlement, 0] };

const legacyCash = { $cond: [{ $eq: ['$method', 'cash'] }, '$total', { $cond: [isSplit, { $ifNull: ['$splitCash', 0] }, 0] }] };
const legacyCard = { $cond: [{ $eq: ['$method', 'card'] }, '$total', { $cond: [isSplit, { $ifNull: ['$splitCard', 0] }, 0] }] };
/** Older orders: credit sales took nothing; unknown methods counted in full. */
const legacySales = {
  $cond: [
    isCredit,
    0,
    { $cond: [isSplit, { $add: [{ $ifNull: ['$splitCash', 0] }, { $ifNull: ['$splitCard', 0] }] }, '$total'] },
  ],
};

/** Money taken at the till, and what went on customer accounts. */
const cashTaken = { $cond: [isSettled, { $ifNull: ['$paidCash', 0] }, legacyCash] };
const cardTaken = { $cond: [isSettled, { $ifNull: ['$paidCard', 0] }, legacyCard] };
const creditGiven = { $cond: [isSettled, { $ifNull: ['$creditAmount', 0] }, { $cond: [isCredit, '$total', 0] }] };

/**
 * Realized sales: only money that reached the drawer or the bank. A credit
 * sale counts for whatever deposit was paid, and the rest as credit.
 */
const salesAccumulators = {
  sales: { $sum: { $cond: [isSettled, { $add: [{ $ifNull: ['$paidCash', 0] }, { $ifNull: ['$paidCard', 0] }] }, legacySales] } },
  orders: { $sum: 1 },
  cash: { $sum: cashTaken },
  card: { $sum: cardTaken },
  creditSales: { $sum: creditGiven },
};

interface SalesRow {
  _id: string | null;
  sales: number;
  orders: number;
  cash: number;
  card: number;
  creditSales: number;
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

// ── Customer Payments (Debt Repayments) ──────────────────────────────────────

interface CustomerPaymentRow {
  _id: string | null;
  sales: number;
  cash: number;
  card: number;
  count: number;
}

function customerPaymentPipeline(range: Range, byDay: boolean): PipelineStage[] {
  return [
    { $match: { createdAt: range } },
    {
      $group: {
        _id: byDay ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } } : null,
        sales: { $sum: '$amountPaid' },
        cash: {
          $sum: {
            $cond: [{ $eq: [{ $toLower: '$paymentMethod' }, 'card'] }, 0, '$amountPaid'],
          },
        },
        card: {
          $sum: {
            $cond: [{ $eq: [{ $toLower: '$paymentMethod' }, 'card'] }, '$amountPaid', 0],
          },
        },
        count: { $sum: 1 },
      },
    },
  ];
}

interface PaymentRow {
  _id: 'cash' | 'card' | 'split' | 'credit' | 'other';
  orders: number;
  total: number;
  splitCash: number;
  splitCard: number;
  /** Cash and card deposits taken on credit sales. */
  depositCash: number;
  depositCard: number;
  /** What went on customer accounts. */
  onAccount: number;
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
              { case: { $eq: ['$method', 'credit'] }, then: 'credit' },
              { case: isSplit, then: 'split' },
            ],
            default: 'other',
          },
        },
        orders: { $sum: 1 },
        total: { $sum: '$total' },
        splitCash: { $sum: { $ifNull: ['$splitCash', 0] } },
        splitCard: { $sum: { $ifNull: ['$splitCard', 0] } },
        depositCash: { $sum: { $cond: [isCredit, cashTaken, 0] } },
        depositCard: { $sum: { $cond: [isCredit, cardTaken, 0] } },
        onAccount: { $sum: creditGiven },
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

function toTotals(
  sales: Partial<SalesRow> | undefined,
  custPayments: Partial<CustomerPaymentRow> | undefined,
  expenses: number,
  newCustomers: number
): KpiTotals {
  const realizedSales = (sales?.sales ?? 0) + (custPayments?.sales ?? 0);
  const realizedCash = (sales?.cash ?? 0) + (custPayments?.cash ?? 0);
  const realizedCard = (sales?.card ?? 0) + (custPayments?.card ?? 0);

  return {
    sales: round2(realizedSales),
    orders: sales?.orders ?? 0,
    cash: round2(realizedCash),
    card: round2(realizedCard),
    expenses: round2(expenses),
    profit: round2(realizedSales - expenses),
    newCustomers,
    duesCollected: round2(custPayments?.sales ?? 0),
    creditSales: round2(sales?.creditSales ?? 0),
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
    [currentCustPayments],
    [previousCustPayments],
    [currentExpenses],
    [previousExpenses],
    currentCustomers,
    previousCustomers,
    dailySales,
    dailyCustPayments,
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
    CustomerPayment.aggregate<CustomerPaymentRow>(customerPaymentPipeline(current, false)),
    CustomerPayment.aggregate<CustomerPaymentRow>(customerPaymentPipeline(previous, false)),
    Expense.aggregate<{ total: number }>(expensePipeline(current, false)),
    Expense.aggregate<{ total: number }>(expensePipeline(previous, false)),
    Customer.countDocuments({ createdAt: current }),
    Customer.countDocuments({ createdAt: previous }),
    Order.aggregate<SalesRow>(salesPipeline(series, true)),
    CustomerPayment.aggregate<CustomerPaymentRow>(customerPaymentPipeline(series, true)),
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
  const custPaymentsByDay = new Map(dailyCustPayments.map((row) => [row._id as string, row]));
  const expensesByDay = new Map(dailyExpenses.map((row) => [row._id, row.total]));
  const customersByDay = new Map(dailyCustomers.map((row) => [row._id, row.count]));

  // Days without activity still need a point, or the sparkline would skip them.
  const daily: KpiDay[] = Array.from({ length: SERIES_DAYS }, (_, offset) => {
    const day = new Date(windows.seriesFrom.getFullYear(), windows.seriesFrom.getMonth(), windows.seriesFrom.getDate() + offset);
    const key = localDayKey(day);
    return {
      date: key,
      ...toTotals(salesByDay.get(key), custPaymentsByDay.get(key), expensesByDay.get(key) ?? 0, customersByDay.get(key) ?? 0),
    };
  });

  return {
    current: toTotals(currentSales, currentCustPayments, currentExpenses?.total ?? 0, currentCustomers),
    previous: toTotals(previousSales, previousCustPayments, previousExpenses?.total ?? 0, previousCustomers),
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
        creditOrders: byKind.get('credit')?.orders ?? 0,
        creditOnly: round2(byKind.get('credit')?.onAccount ?? 0),
        creditDepositCash: round2(byKind.get('credit')?.depositCash ?? 0),
        creditDepositCard: round2(byKind.get('credit')?.depositCard ?? 0),
        duesOrders: currentCustPayments?.count ?? 0,
        duesCash: round2(currentCustPayments?.cash ?? 0),
        duesCard: round2(currentCustPayments?.card ?? 0),
        duesTotal: round2(currentCustPayments?.sales ?? 0),
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
