/**
 * Data the detail views read. Figures come from the month-to-date KPIs so a
 * view always agrees with its card; the lists come from the regular endpoints.
 */
import type { DashboardKpis } from '../../../services/dashboardService';

export interface DashboardOrder {
  invoiceId?: string;
  createdAt?: string;
  total?: number;
  paymentMethod?: string;
  splitCash?: number | null;
  splitCard?: number | null;
}

export interface DashboardExpense {
  title?: string;
  category?: string;
  amount?: number;
  date?: string;
}

export interface DashboardCustomer {
  name?: string;
  timesVisited?: number;
  totalAmount?: number;
}

export interface DetailContext {
  kpis: DashboardKpis;
  /** Newest first. */
  orders: DashboardOrder[];
  /** Newest first. */
  expenses: DashboardExpense[];
  customers: DashboardCustomer[];
}
