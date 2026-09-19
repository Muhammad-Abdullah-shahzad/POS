/**
 * Month-to-date KPIs for the admin dashboard, from the API in the browser or
 * from the local database on the desktop till. Both return the same shape.
 */
import api from './api';

export interface KpiTotals {
  /** Sales including VAT. */
  sales: number;
  orders: number;
  cash: number;
  card: number;
  expenses: number;
  profit: number;
  newCustomers: number;
}

export interface KpiDay extends KpiTotals {
  date: string;
}

/** Detail behind this month's totals, for the drill-down views. */
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
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStockItems: { name: string; category: string; stock: number; price: number }[];
}

export interface DashboardKpis {
  /** This month so far. */
  current: KpiTotals;
  /** The same days of last month. */
  previous: KpiTotals;
  /** The last 30 days, oldest first. */
  daily: KpiDay[];
  breakdown: KpiBreakdown;
  catalogue: { products: number; lowStock: number; outOfStock: number; categories: number; customers: number };
  /** ISO timestamps. The previous period ends at the same day and time of last month. */
  periods: { currentFrom: string; previousFrom: string; previousTo: string; generatedAt: string };
}

export async function fetchDashboardKpis(): Promise<DashboardKpis> {
  const { data } = await api.get('/analytics/kpis');
  return data.data as DashboardKpis;
}

/**
 * Percentage change from last month: (current − previous) / previous × 100.
 * Null when last month had nothing to compare with.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const formatDay = (iso: string): string => dayMonth.format(new Date(iso));

/** "Sep 1 to today" */
export const currentPeriodLabel = ({ currentFrom }: DashboardKpis['periods']): string => `${formatDay(currentFrom)} to today`;

/** "Sep 1 to today, compared with Aug 1 to Aug 19." */
export const comparedPeriodsLabel = (periods: DashboardKpis['periods']): string =>
  `${currentPeriodLabel(periods)}, compared with ${formatDay(periods.previousFrom)} to ${formatDay(periods.previousTo)}.`;
