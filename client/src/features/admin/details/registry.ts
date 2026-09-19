/**
 * Which view each KPI card opens, with the title and subtitle it shows.
 * Adding a card means adding its key here, with a view from views.tsx.
 */
import type { ComponentType } from 'react';
import { currentPeriodLabel } from '../../../services/dashboardService';
import type { DashboardKpis } from '../../../services/dashboardService';
import type { KpiKey } from '../DashboardKpiGrid';
import type { DetailContext } from './types';
import {
  CardView,
  CashView,
  CustomersView,
  ExpensesView,
  LowStockView,
  ProductsView,
  ProfitView,
  RevenueView,
} from './views';

export interface DetailView {
  title: string;
  /** Under the title: the period for monthly figures, or what a snapshot covers. */
  subtitle: (kpis: DashboardKpis) => string;
  Content: ComponentType<DetailContext>;
}

const thisMonth = (kpis: DashboardKpis): string => currentPeriodLabel(kpis.periods);

export const DETAIL_VIEWS: Record<KpiKey, DetailView> = {
  'total-sales': { title: 'Total Revenue', subtitle: thisMonth, Content: RevenueView },
  profit: { title: 'Net Profit', subtitle: thisMonth, Content: ProfitView },
  expenses: { title: 'Expenses', subtitle: thisMonth, Content: ExpensesView },
  cash: { title: 'Cash Sales', subtitle: thisMonth, Content: CashView },
  card: { title: 'Card Sales', subtitle: thisMonth, Content: CardView },
  customers: { title: 'Customers', subtitle: () => 'Everyone registered with your shop', Content: CustomersView },
  products: { title: 'Products', subtitle: () => 'Your catalogue today', Content: ProductsView },
  'low-stock': { title: 'Low Stock', subtitle: () => 'Products with 10 units or fewer', Content: LowStockView },
};
