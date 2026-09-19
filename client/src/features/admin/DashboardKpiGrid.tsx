/**
 * The admin dashboard's KPI panel: month-to-date money figures with their
 * change from the same days of last month, then catalogue and customer counts.
 */
import { comparedPeriodsLabel, percentChange } from '../../services/dashboardService';
import type { DashboardKpis, KpiTotals } from '../../services/dashboardService';
import { formatMoney, formatMoneyCompact, formatMoneyWhole } from '../../utils/money';
import ArtPanel from '../../components/ArtPanel';
import KpiCard from './KpiCard';
import classes from './KpiCard.module.css';

/** Each card opens the detail view with the same key. */
export type KpiKey = 'total-sales' | 'profit' | 'expenses' | 'cash' | 'card' | 'customers' | 'products' | 'low-stock';

interface MoneyKpi {
  key: KpiKey;
  title: string;
  field: Exclude<keyof KpiTotals, 'orders' | 'newCustomers'>;
  info: string;
  goodWhenUp?: boolean;
}

const MONEY_KPIS: MoneyKpi[] = [
  { key: 'total-sales', title: 'Total Revenue', field: 'sales', info: 'Sales including VAT. Voided sales are left out.' },
  { key: 'profit', title: 'Net Profit', field: 'profit', info: 'Revenue minus expenses.' },
  { key: 'expenses', title: 'Expenses', field: 'expenses', info: 'Expenses dated in the period. A fall shows in green.', goodWhenUp: false },
  { key: 'cash', title: 'Cash Sales', field: 'cash', info: 'Cash sales plus the cash part of split payments.' },
  { key: 'card', title: 'Card Sales', field: 'card', info: 'Card sales plus the card part of split payments.' },
];

/** Past this, a whole amount such as "Rs 12,345,678" no longer fits a card. */
const COMPACT_FROM = 100_000;

const formatHeadline = (amount: number): string =>
  Math.abs(amount) < COMPACT_FROM ? formatMoneyWhole(amount) : formatMoneyCompact(amount);

const formatPeak = (amount: number): string =>
  Math.abs(amount) < 1000 ? formatMoneyWhole(amount) : formatMoneyCompact(amount);

const plural = (count: number, one: string, many: string): string =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

interface DashboardKpiGridProps {
  kpis: DashboardKpis;
  onOpen: (key: KpiKey) => void;
}

export default function DashboardKpiGrid({ kpis, onOpen }: DashboardKpiGridProps) {
  const { current, previous, daily, catalogue } = kpis;
  const period = comparedPeriodsLabel(kpis.periods);

  return (
    <ArtPanel title="Business Overview" subtitle={period}>
      <div className={classes.gridContainer}>
        <div className={classes.grid}>
          {MONEY_KPIS.map(({ key, title, field, info, goodWhenUp }) => (
            <KpiCard
              key={key}
              title={title}
              info={`${info} ${period}`}
              value={formatHeadline(current[field])}
              trend={{ percent: percentChange(current[field], previous[field]), goodWhenUp }}
              series={daily.map((day) => ({ date: day.date, value: day[field] }))}
              formatPoint={formatPeak}
              formatExact={formatMoney}
              glass
              onClick={() => onOpen(key)}
            />
          ))}

          <KpiCard
            title="Customers"
            glass
            info="Registered customers. New this month counts sign-ups since the 1st."
            value={catalogue.customers.toLocaleString()}
            footnote={`${current.newCustomers.toLocaleString()} new this month`}
            onClick={() => onOpen('customers')}
          />
          <KpiCard
            title="Products"
            glass
            info="Products in your catalogue."
            value={catalogue.products.toLocaleString()}
            footnote={`In ${plural(catalogue.categories, 'category', 'categories')}`}
            onClick={() => onOpen('products')}
          />
          <KpiCard
            title="Low Stock"
            glass
            info="Products with 10 units or fewer left."
            value={catalogue.lowStock.toLocaleString()}
            footnote={catalogue.lowStock > 0 ? 'Need restocking soon' : 'Everything is well stocked'}
            onClick={() => onOpen('low-stock')}
          />
        </div>
      </div>
    </ArtPanel>
  );
}
