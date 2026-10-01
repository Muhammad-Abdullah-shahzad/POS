/**
 * Month-to-date KPIs for the admin dashboard, from the API in the browser or
 * from the local database on the desktop till. Both return the same shape.
 */
import api from './api';

export interface KpiTotals {
  /** Realized sales/revenue (money received in drawer & bank). */
  sales: number;
  orders: number;
  cash: number;
  card: number;
  expenses: number;
  profit: number;
  newCustomers: number;
  duesCollected?: number;
  /** Credit given, less what returns took off customer accounts. */
  creditSales?: number;
  /** Refunded on returns, however it was paid out. */
  refunds?: number;
  returns?: number;
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
    creditOrders?: number;
    /** What went on customer accounts (credit sales, less any deposits). */
    creditOnly?: number;
    /** Cash and card deposits taken on credit sales. */
    creditDepositCash?: number;
    creditDepositCard?: number;
    duesOrders?: number;
    duesCash?: number;
    duesCard?: number;
    duesTotal?: number;
  };
  expenseCategories: { category: string; total: number; count: number }[];
  expenseCount: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  lowStockItems: { name: string; category: string; stock: number; price: number }[];
  /** Returns this period and how their refunds were paid out. */
  returns?: { count: number; total: number; cash: number; card: number; toAccount: number };
}

/** What the dashboard covers: today so far, or this month so far. */
export type KpiPeriod = 'day' | 'month';

export interface DashboardKpis {
  /** Today so far, or this month so far. */
  current: KpiTotals;
  /** Yesterday up to the same time, or the same days of last month. */
  previous: KpiTotals;
  /** The last 30 days, oldest first. */
  daily: KpiDay[];
  breakdown: KpiBreakdown;
  catalogue: { products: number; lowStock: number; outOfStock: number; categories: number; customers: number };
  /** ISO timestamps. The previous period ends at the same time of yesterday, or the same day and time of last month. */
  periods: { period?: KpiPeriod; currentFrom: string; previousFrom: string; previousTo: string; generatedAt: string };
}

export async function fetchDashboardKpis(period: KpiPeriod = 'month'): Promise<DashboardKpis> {
  const { data } = await api.get('/analytics/kpis', { params: { period } });
  return data.data as DashboardKpis;
}

/** The words for the period on show, e.g. "No sales yet today" or "… this month". */
export function periodWords(periods: DashboardKpis['periods']): { current: string; previous: string; possessive: string } {
  return periods.period === 'day'
    ? { current: 'today', previous: 'yesterday', possessive: "today's" }
    : { current: 'this month', previous: 'last month', possessive: "this month's" };
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

const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

/** "Today, Oct 1" or "Sep 1 to today" */
export const currentPeriodLabel = (periods: DashboardKpis['periods']): string =>
  periods.period === 'day' ? `Today, ${formatDay(periods.currentFrom)}` : `${formatDay(periods.currentFrom)} to today`;

/** "Today so far, compared with yesterday up to 14:30." or "Sep 1 to today, compared with Aug 1 to Aug 19." */
export const comparedPeriodsLabel = (periods: DashboardKpis['periods']): string =>
  periods.period === 'day'
    ? `Today so far, compared with yesterday up to ${timeOfDay.format(new Date(periods.previousTo))}.`
    : `${currentPeriodLabel(periods)}, compared with ${formatDay(periods.previousFrom)} to ${formatDay(periods.previousTo)}.`;
