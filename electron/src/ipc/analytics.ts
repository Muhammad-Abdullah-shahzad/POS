import { handleLicensed } from '../license/licenseGuard';
import { dbAll } from '../db/database';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthKey(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, mon] = key.split('-');
  return `${MONTH_NAMES[parseInt(mon) - 1]} ${year}`;
}


// ── KPIs (mirrors server/services/kpiService.ts) ───────────────────────────────

const SERIES_DAYS = 30;
const LOW_STOCK_THRESHOLD = 10;
const TOP_PRODUCTS = 6;
const LOW_STOCK_LIST = 100;

interface KpiTotals {
  sales: number;
  orders: number;
  cash: number;
  card: number;
  expenses: number;
  profit: number;
  newCustomers: number;
  /** Dues collected from customers. */
  duesCollected: number;
  /** Credit given on sales, less what returns took off customer accounts. */
  creditSales: number;
  /** Refunded on returns, however it was paid out. */
  refunds: number;
  returns: number;
}

const emptyTotals = (): KpiTotals => ({
  sales: 0, orders: 0, cash: 0, card: 0, expenses: 0, profit: 0, newCustomers: 0,
  duesCollected: 0, creditSales: 0, refunds: 0, returns: 0,
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type KpiPeriod = 'day' | 'month';

/**
 * The span the dashboard covers, what it is compared with, and the sparkline
 * span: today so far against yesterday up to the same time, or this month so
 * far against the same days of last month.
 */
function kpiWindows(now: Date, period: KpiPeriod = 'month') {
  if (period === 'day') {
    const currentFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const previousFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const previousTo = new Date(previousFrom.getFullYear(), previousFrom.getMonth(), previousFrom.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    const seriesFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SERIES_DAYS - 1));
    return { currentFrom, previousFrom, previousTo, seriesFrom };
  }

  const currentFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
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

/**
 * What a sale took at the till and put on account. Sales recorded since the
 * till began saving this add up to their total; older ones read zeros there,
 * so they are worked out from the payment method as before.
 */
function takenAtTill(row: Record<string, unknown>): { cash: number; card: number; credit: number } {
  const recorded = {
    cash: Number(row.paidCash) || 0,
    card: Number(row.paidCard) || 0,
    credit: Number(row.creditAmount) || 0,
  };
  if (recorded.cash + recorded.card + recorded.credit > 0) return recorded;

  const total = Number(row.total) || 0;
  const method = String(row.paymentMethod ?? '').toLowerCase();
  if (method === 'card') return { cash: 0, card: total, credit: 0 };
  if (method === 'credit') return { cash: 0, card: 0, credit: total };
  if (method.startsWith('split')) return { cash: Number(row.splitCash) || 0, card: Number(row.splitCard) || 0, credit: 0 };
  return { cash: total, card: 0, credit: 0 };
}

/** Realized sales: only money that reached the drawer or the bank. */
function addSale(totals: KpiTotals, row: Record<string, unknown>): void {
  const taken = takenAtTill(row);
  totals.orders += 1;
  totals.cash += taken.cash;
  totals.card += taken.card;
  totals.sales += taken.cash + taken.card;
  totals.creditSales += taken.credit;
}

/**
 * A return is money leaving the business on the day it is taken: refunds paid
 * in cash or by card come off cash, card and sales; a refund taken off a
 * customer's account lowers the credit given instead.
 */
function addReturn(totals: KpiTotals, row: Record<string, unknown>): void {
  const cash = Number(row.refundCash) || 0;
  const card = Number(row.refundCard) || 0;
  totals.returns += 1;
  totals.refunds += Number(row.total) || 0;
  totals.cash -= cash;
  totals.card -= card;
  totals.sales -= cash + card;
  totals.creditSales -= Number(row.refundToAccount) || 0;
}

function addCustomerPayment(totals: KpiTotals, row: Record<string, unknown>): void {
  const amount = Number(row.amountPaid) || 0;
  const method = String(row.paymentMethod ?? '').toLowerCase();

  totals.sales += amount; // Realized money in drawer/bank
  totals.duesCollected += amount;
  if (method === 'card') {
    totals.card += amount;
  } else {
    totals.cash += amount;
  }
}

function finish(totals: KpiTotals): KpiTotals {
  return {
    sales: round2(totals.sales),
    orders: totals.orders,
    cash: round2(totals.cash),
    card: round2(totals.card),
    expenses: round2(totals.expenses),
    profit: round2(totals.sales - totals.expenses),
    newCustomers: totals.newCustomers,
    duesCollected: round2(totals.duesCollected),
    creditSales: round2(totals.creditSales),
    refunds: round2(totals.refunds),
    returns: totals.returns,
  };
}

/** What came back per product, keyed like the sales: by product id, or by name for loose items. */
function returnedByProduct(rows: Record<string, unknown>[]): Map<string, { quantity: number; refunded: number }> {
  const back = new Map<string, { quantity: number; refunded: number }>();
  for (const row of rows) {
    let items: Array<Record<string, unknown>> = [];
    try { items = JSON.parse(String(row.items || '[]')); } catch { items = []; }
    for (const item of items) {
      const key = String(item.product || item.name || '');
      if (!key) continue;
      const entry = back.get(key) ?? { quantity: 0, refunded: 0 };
      entry.quantity += Number(item.quantity) || 0;
      entry.refunded += Number(item.total) || 0;
      back.set(key, entry);
    }
  }
  return back;
}

const liveReturnsSince = (since: string) =>
  dbAll(
    `SELECT items, total, refundCash, refundCard, refundToAccount, createdAt FROM product_returns
     WHERE (deletedAt IS NULL OR deletedAt = '') AND createdAt >= $since`,
    { $since: since }
  );

export function registerAnalyticsHandlers(): void {

  // ── kpis ──────────────────────────────────────────────────────────────────
  handleLicensed('analytics:kpis', (_e, requested?: string) => {
    const period: KpiPeriod = requested === 'day' ? 'day' : 'month';
    const now = new Date();
    const windows = kpiWindows(now, period);
    const earliest = new Date(Math.min(windows.previousFrom.getTime(), windows.seriesFrom.getTime()));
    const since = earliest.toISOString();

    const orders = dbAll(
      `SELECT items, total, paymentMethod, splitCash, splitCard, paidCash, paidCard, creditAmount, createdAt FROM orders
       WHERE status != 'voided' AND (deletedAt IS NULL OR deletedAt = '') AND createdAt >= $since`,
      { $since: since }
    );
    const custPayments = dbAll(
      `SELECT amountPaid, paymentMethod, createdAt FROM customer_payments
       WHERE (deletedAt IS NULL OR deletedAt = '') AND createdAt >= $since`,
      { $since: since }
    );
    // Expense dates are stored in more than one format, so they are filtered after parsing.
    const expenses = dbAll(`SELECT amount, category, date FROM expenses WHERE (deletedAt IS NULL OR deletedAt = '')`);
    const newCustomers = dbAll(
      `SELECT createdAt FROM customers WHERE (deletedAt IS NULL OR deletedAt = '') AND createdAt >= $since`,
      { $since: since }
    );

    const current = emptyTotals();
    const previous = emptyTotals();
    const days = new Map<string, KpiTotals>();
    for (let offset = 0; offset < SERIES_DAYS; offset += 1) {
      const day = new Date(windows.seriesFrom.getFullYear(), windows.seriesFrom.getMonth(), windows.seriesFrom.getDate() + offset);
      days.set(localDayKey(day), emptyTotals());
    }

    // Adds one record to every bucket its date falls in.
    const place = (at: Date, apply: (totals: KpiTotals) => void) => {
      if (Number.isNaN(at.getTime())) return;
      if (at >= windows.currentFrom) apply(current);
      if (at >= windows.previousFrom && at < windows.previousTo) apply(previous);
      if (at >= windows.seriesFrom) {
        const bucket = days.get(localDayKey(at));
        if (bucket) apply(bucket);
      }
    };

    for (const row of orders) place(new Date(String(row.createdAt)), (totals) => addSale(totals, row));
    for (const row of custPayments) place(new Date(String(row.createdAt)), (totals) => addCustomerPayment(totals, row));
    for (const row of expenses) place(new Date(String(row.date)), (totals) => { totals.expenses += Number(row.amount) || 0; });
    for (const row of newCustomers) place(new Date(String(row.createdAt)), (totals) => { totals.newCustomers += 1; });
    const returns = liveReturnsSince(since);
    for (const row of returns) place(new Date(String(row.createdAt)), (totals) => addReturn(totals, row));
    const returnsThisMonth = returns.filter((row) => new Date(String(row.createdAt)) >= windows.currentFrom);
    const returnedThisMonth = returnedByProduct(returnsThisMonth);

    // Detail behind this month's totals, for the dashboard's drill-down views.
    const payments = {
      cashOrders: 0,
      cashOnly: 0,
      cardOrders: 0,
      cardOnly: 0,
      splitOrders: 0,
      splitCash: 0,
      splitCard: 0,
      creditOrders: 0,
      creditOnly: 0,
      creditDepositCash: 0,
      creditDepositCard: 0,
      duesOrders: 0,
      duesCash: 0,
      duesCard: 0,
      duesTotal: 0,
    };
    const products = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const row of orders) {
      if (new Date(String(row.createdAt)) < windows.currentFrom) continue;

      const total = Number(row.total) || 0;
      const method = String(row.paymentMethod ?? '').toLowerCase();
      if (method === 'cash') {
        payments.cashOrders += 1;
        payments.cashOnly += total;
      } else if (method === 'card') {
        payments.cardOrders += 1;
        payments.cardOnly += total;
      } else if (method.startsWith('split')) {
        payments.splitOrders += 1;
        payments.splitCash += Number(row.splitCash) || 0;
        payments.splitCard += Number(row.splitCard) || 0;
      } else if (method === 'credit') {
        const taken = takenAtTill(row);
        payments.creditOrders += 1;
        payments.creditOnly += taken.credit;
        payments.creditDepositCash += taken.cash;
        payments.creditDepositCard += taken.card;
      }

      let items: Array<Record<string, unknown>> = [];
      try { items = JSON.parse(String(row.items || '[]')); } catch { items = []; }
      for (const item of items) {
        const key = String(item.product || item.name || '');
        if (!key) continue;
        const entry = products.get(key) ?? { name: String(item.name || key), quantity: 0, revenue: 0 };
        entry.quantity += Number(item.quantity) || 0;
        entry.revenue += Number(item.totalPrice) || 0;
        products.set(key, entry);
      }
    }

    for (const row of custPayments) {
      if (new Date(String(row.createdAt)) < windows.currentFrom) continue;
      const amount = Number(row.amountPaid) || 0;
      const method = String(row.paymentMethod ?? '').toLowerCase();
      payments.duesOrders += 1;
      payments.duesTotal += amount;
      if (method === 'card') {
        payments.duesCard += amount;
      } else {
        payments.duesCash += amount;
      }
    }

    const categories = new Map<string, { total: number; count: number }>();
    for (const row of expenses) {
      if (new Date(String(row.date)) < windows.currentFrom) continue;
      const category = String(row.category || 'Other');
      const entry = categories.get(category) ?? { total: 0, count: 0 };
      entry.total += Number(row.amount) || 0;
      entry.count += 1;
      categories.set(category, entry);
    }

    const count = (sql: string): number => Number(dbAll(sql)[0]?.count ?? 0);
    const liveProducts = `FROM products WHERE (deletedAt IS NULL OR deletedAt = '')`;

    return {
      current: finish(current),
      previous: finish(previous),
      daily: [...days.entries()].map(([date, totals]) => ({ date, ...finish(totals) })),
      breakdown: {
        payments: {
          ...payments,
          cashOnly: round2(payments.cashOnly),
          cardOnly: round2(payments.cardOnly),
          splitCash: round2(payments.splitCash),
          splitCard: round2(payments.splitCard),
          creditOnly: round2(payments.creditOnly),
          creditDepositCash: round2(payments.creditDepositCash),
          creditDepositCard: round2(payments.creditDepositCard),
        },
        expenseCategories: [...categories.entries()]
          .map(([category, entry]) => ({ category, total: round2(entry.total), count: entry.count }))
          .sort((a, b) => b.total - a.total),
        expenseCount: [...categories.values()].reduce((sum, entry) => sum + entry.count, 0),
        // Best sellers net of what came back.
        topProducts: [...products.entries()]
          .map(([key, entry]) => {
            const came = returnedThisMonth.get(key);
            return { name: entry.name, quantity: round2(entry.quantity - (came?.quantity ?? 0)), revenue: round2(entry.revenue - (came?.refunded ?? 0)) };
          })
          .filter((entry) => entry.quantity > 0 || entry.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, TOP_PRODUCTS),
        returns: {
          count: returnsThisMonth.length,
          total: round2(returnsThisMonth.reduce((sum, row) => sum + (Number(row.total) || 0), 0)),
          cash: round2(returnsThisMonth.reduce((sum, row) => sum + (Number(row.refundCash) || 0), 0)),
          card: round2(returnsThisMonth.reduce((sum, row) => sum + (Number(row.refundCard) || 0), 0)),
          toAccount: round2(returnsThisMonth.reduce((sum, row) => sum + (Number(row.refundToAccount) || 0), 0)),
        },
        lowStockItems: dbAll(
          `SELECT name, category, stock, price ${liveProducts} AND stock <= ${LOW_STOCK_THRESHOLD}
           ORDER BY stock ASC, name ASC LIMIT ${LOW_STOCK_LIST}`
        ).map((row) => ({
          name: String(row.name ?? ''),
          category: String(row.category ?? ''),
          stock: Number(row.stock) || 0,
          price: Number(row.price) || 0,
        })),
      },
      catalogue: {
        products: count(`SELECT COUNT(*) AS count ${liveProducts}`),
        lowStock: count(`SELECT COUNT(*) AS count ${liveProducts} AND stock <= ${LOW_STOCK_THRESHOLD}`),
        outOfStock: count(`SELECT COUNT(*) AS count ${liveProducts} AND stock <= 0`),
        categories: count(`SELECT COUNT(DISTINCT category) AS count ${liveProducts} AND category IS NOT NULL AND category != ''`),
        customers: count(`SELECT COUNT(*) AS count FROM customers WHERE (deletedAt IS NULL OR deletedAt = '')`),
      },
      periods: {
        period,
        currentFrom: windows.currentFrom.toISOString(),
        previousFrom: windows.previousFrom.toISOString(),
        previousTo: windows.previousTo.toISOString(),
        generatedAt: now.toISOString(),
      },
    };
  });
  // ── monthly-summary ────────────────────────────────────────────────────────
  handleLicensed('analytics:monthlySummary', (_e, months = 6) => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months + 1);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffStr = cutoff.toISOString();

    // As on the server: money received. Credit sales count when the customer pays,
    // and refunds paid out in cash or by card come off the month they were taken.
    const orders = dbAll(
      `SELECT total, totalVAT, createdAt FROM orders
       WHERE status != 'voided' AND (deletedAt IS NULL OR deletedAt = '')
         AND paymentMethod != 'credit' AND createdAt >= $cutoff`,
      { $cutoff: cutoffStr }
    );
    const dues = dbAll(
      `SELECT amountPaid, createdAt FROM customer_payments
       WHERE (deletedAt IS NULL OR deletedAt = '') AND createdAt >= $cutoff`,
      { $cutoff: cutoffStr }
    );
    const returns = liveReturnsSince(cutoffStr);

    const expenses = dbAll(
      `SELECT amount, date FROM expenses
       WHERE (deletedAt IS NULL OR deletedAt = '') AND date >= $cutoff`,
      { $cutoff: cutoffStr }
    );

    type Month = { month: string; revenue: number; vat: number; expenses: number; orders: number; profit: number; refunds: number; returns: number };
    const merged: Record<string, Month> = {};
    const bucket = (key: string): Month =>
      (merged[key] ??= { month: monthLabel(key), revenue: 0, vat: 0, expenses: 0, orders: 0, profit: 0, refunds: 0, returns: 0 });

    for (const o of orders) {
      const key = monthKey(o.createdAt as string);
      if (!key) continue;
      const month = bucket(key);
      month.revenue += (Number(o.total) || 0) - (Number(o.totalVAT) || 0);
      month.vat += Number(o.totalVAT) || 0;
      month.orders += 1;
    }

    for (const d of dues) {
      const key = monthKey(d.createdAt as string);
      if (key) bucket(key).revenue += Number(d.amountPaid) || 0;
    }

    for (const r of returns) {
      const key = monthKey(r.createdAt as string);
      if (!key) continue;
      const month = bucket(key);
      const paidOut = (Number(r.refundCash) || 0) + (Number(r.refundCard) || 0);
      month.revenue -= paidOut;
      month.refunds += paidOut;
      month.returns += 1;
    }

    for (const e of expenses) {
      const key = monthKey(e.date as string);
      if (key) bucket(key).expenses += Number(e.amount) || 0;
    }

    for (const key of Object.keys(merged)) {
      merged[key].profit = merged[key].revenue - merged[key].expenses;
    }

    const monthly = Object.keys(merged).sort().map((k) => merged[k]);

    const lowStock = dbAll(
      `SELECT _id, name, sku, stock, category FROM products
       WHERE stock <= 10 AND (deletedAt IS NULL OR deletedAt = '')
       ORDER BY stock ASC LIMIT 10`
    );

    return { monthly, lowStock };
  });

  // ── top-products ───────────────────────────────────────────────────────────
  handleLicensed('analytics:topProducts', (_e, limit = 10) => {
    const orders = dbAll(
      `SELECT items FROM orders
       WHERE status != 'voided' AND (deletedAt IS NULL OR deletedAt = '')`
    );

    const map: Record<string, { productId: string; name: string; totalQty: number; totalRevenue: number }> = {};

    for (const o of orders) {
      let items: any[] = [];
      try { items = JSON.parse(o.items as string || '[]'); } catch { continue; }
      for (const item of items) {
        const key = item.product || item.name;
        if (!key) continue;
        if (!map[key]) map[key] = { productId: item.product, name: item.name || key, totalQty: 0, totalRevenue: 0 };
        map[key].totalQty     += item.quantity  || 0;
        map[key].totalRevenue += item.totalPrice || 0;
      }
    }

    // Net of what came back.
    const back = returnedByProduct(liveReturnsSince(''));
    const topItems = Object.entries(map)
      .map(([key, item]) => {
        const came = back.get(String(key));
        return { ...item, totalQty: item.totalQty - (came?.quantity ?? 0), totalRevenue: round2(item.totalRevenue - (came?.refunded ?? 0)) };
      })
      .filter((item) => item.totalQty > 0 || item.totalRevenue > 0)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    // Look up full product info for each top item, matching the server's output
    return topItems.map(item => {
      let productInfo = null;
      if (item.productId) {
        const productRows = dbAll(`SELECT * FROM products WHERE _id = $id`, { $id: item.productId });
        if (productRows.length > 0) {
          productInfo = productRows[0];
        }
      }
      return {
        ...item,
        product: productInfo,
      };
    });
  });

  // ── payment-methods ────────────────────────────────────────────────────────
  handleLicensed('analytics:paymentMethods', () => {
    const rows = dbAll(
      `SELECT paymentMethod, COUNT(*) as count, SUM(total) as total
       FROM orders
       WHERE status != 'voided' AND (deletedAt IS NULL OR deletedAt = '')
       GROUP BY paymentMethod
       ORDER BY total DESC`
    );
    return rows.map((r) => ({ method: r.paymentMethod, count: r.count, total: r.total }));
  });

  // ── expense-categories ─────────────────────────────────────────────────────
  handleLicensed('analytics:expenseCategories', () => {
    const rows = dbAll(
      `SELECT category, SUM(amount) as total, COUNT(*) as count
       FROM expenses
       WHERE (deletedAt IS NULL OR deletedAt = '')
       GROUP BY category
       ORDER BY total DESC`
    );
    return rows.map((r) => ({ category: r.category, total: r.total, count: r.count }));
  });
}
