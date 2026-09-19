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
}

const emptyTotals = (): KpiTotals => ({ sales: 0, orders: 0, cash: 0, card: 0, expenses: 0, profit: 0, newCustomers: 0 });

const round2 = (value: number): number => Math.round(value * 100) / 100;

const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** This month so far, the same days of last month, and the sparkline span. */
function kpiWindows(now: Date) {
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

function addSale(totals: KpiTotals, row: Record<string, unknown>): void {
  const total = Number(row.total) || 0;
  const method = String(row.paymentMethod ?? '').toLowerCase();

  totals.sales += total;
  totals.orders += 1;
  if (method === 'cash') totals.cash += total;
  else if (method === 'card') totals.card += total;
  else if (method.startsWith('split')) {
    totals.cash += Number(row.splitCash) || 0;
    totals.card += Number(row.splitCard) || 0;
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
  };
}

export function registerAnalyticsHandlers(): void {

  // ── kpis ──────────────────────────────────────────────────────────────────
  handleLicensed('analytics:kpis', () => {
    const now = new Date();
    const windows = kpiWindows(now);
    const earliest = new Date(Math.min(windows.previousFrom.getTime(), windows.seriesFrom.getTime()));
    const since = earliest.toISOString();

    const orders = dbAll(
      `SELECT items, total, paymentMethod, splitCash, splitCard, createdAt FROM orders
       WHERE status != 'voided' AND (deletedAt IS NULL OR deletedAt = '') AND createdAt >= $since`,
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
    for (const row of expenses) place(new Date(String(row.date)), (totals) => { totals.expenses += Number(row.amount) || 0; });
    for (const row of newCustomers) place(new Date(String(row.createdAt)), (totals) => { totals.newCustomers += 1; });

    // Detail behind this month's totals, for the dashboard's drill-down views.
    const payments = { cashOrders: 0, cashOnly: 0, cardOrders: 0, cardOnly: 0, splitOrders: 0, splitCash: 0, splitCard: 0 };
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
        },
        expenseCategories: [...categories.entries()]
          .map(([category, entry]) => ({ category, total: round2(entry.total), count: entry.count }))
          .sort((a, b) => b.total - a.total),
        expenseCount: [...categories.values()].reduce((sum, entry) => sum + entry.count, 0),
        topProducts: [...products.values()]
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, TOP_PRODUCTS)
          .map((entry) => ({ ...entry, revenue: round2(entry.revenue) })),
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

    const orders = dbAll(
      `SELECT total, totalVAT, createdAt FROM orders
       WHERE status != 'voided' AND (deletedAt IS NULL OR deletedAt = '')
         AND createdAt >= $cutoff`,
      { $cutoff: cutoffStr }
    );

    const expenses = dbAll(
      `SELECT amount, date FROM expenses
       WHERE (deletedAt IS NULL OR deletedAt = '') AND date >= $cutoff`,
      { $cutoff: cutoffStr }
    );

    const merged: Record<string, { month: string; revenue: number; expenses: number; orders: number; profit: number }> = {};

    for (const o of orders) {
      const key = monthKey(o.createdAt as string);
      if (!key) continue;
      if (!merged[key]) merged[key] = { month: monthLabel(key), revenue: 0, expenses: 0, orders: 0, profit: 0 };
      merged[key].revenue += ((o.total as number) - (o.totalVAT as number));
      merged[key].orders  += 1;
    }

    for (const e of expenses) {
      const key = monthKey(e.date as string);
      if (!key) continue;
      if (!merged[key]) merged[key] = { month: monthLabel(key), revenue: 0, expenses: 0, orders: 0, profit: 0 };
      merged[key].expenses += (e.amount as number);
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

    const map: Record<string, { name: string; totalQty: number; totalRevenue: number }> = {};

    for (const o of orders) {
      let items: any[] = [];
      try { items = JSON.parse(o.items as string || '[]'); } catch { continue; }
      for (const item of items) {
        const key = item.product || item.name;
        if (!key) continue;
        if (!map[key]) map[key] = { name: item.name || key, totalQty: 0, totalRevenue: 0 };
        map[key].totalQty     += item.quantity  || 0;
        map[key].totalRevenue += item.totalPrice || 0;
      }
    }

    return Object.values(map)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
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
