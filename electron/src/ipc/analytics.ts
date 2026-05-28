import { ipcMain } from 'electron';
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

export function registerAnalyticsHandlers(): void {
  // ── monthly-summary ────────────────────────────────────────────────────────
  ipcMain.handle('analytics:monthlySummary', (_e, months = 6) => {
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
  ipcMain.handle('analytics:topProducts', (_e, limit = 10) => {
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
  ipcMain.handle('analytics:paymentMethods', () => {
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
  ipcMain.handle('analytics:expenseCategories', () => {
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
