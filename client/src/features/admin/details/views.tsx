/**
 * What each KPI card opens: one view per card, built from the shared blocks.
 *
 * Figures come from the month-to-date KPIs, so every view agrees with its
 * card. To add a view, write a component here and register it in registry.ts
 * under the card's key.
 */
import { currentPeriodLabel, percentChange } from '../../../services/dashboardService';
import type { DashboardKpis, KpiTotals } from '../../../services/dashboardService';
import { formatMoney } from '../../../utils/money';
import { formatMoneyAxis as moneyAxis } from '../chartFormat';
import { PALETTE } from '../palette';
import { PAYMENT_METHODS, paymentMethodKey, paymentMethodOf } from '../paymentMethods';
import { Empty, Pill, RankedList, Section, ShareBar, StatGrid, StatTile } from './blocks';
import DailyChart from './DailyChart';
import DataTable from './DataTable';
import type { Column } from './DataTable';
import classes from './DetailModal.module.css';
import type { DashboardExpense, DashboardOrder, DetailContext } from './types';

const LATEST_ROWS = 20;
const TOP_CUSTOMERS = 10;

// ── Formatting ──────────────────────────────────────────────────────────────

const count = (value: number): string => value.toLocaleString();
const plural = (value: number, one: string, many: string): string => `${count(value)} ${value === 1 ? one : many}`;
const percentOf = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);

const dateTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const formatWhen = (iso?: string): string => (iso ? dateTime.format(new Date(iso)) : '—');
const formatDate = (iso?: string): string => (iso ? dateOnly.format(new Date(iso)) : '—');

const change = (field: keyof KpiTotals, kpis: DashboardKpis) => percentChange(kpis.current[field], kpis.previous[field]);
const dailySeries = (kpis: DashboardKpis, field: keyof KpiTotals) => kpis.daily.map((day) => ({ date: day.date, value: day[field] }));

const isSplitPayment = (order: DashboardOrder): boolean => paymentMethodKey(order.paymentMethod) === 'split';

// ── Table columns ───────────────────────────────────────────────────────────

const receiptColumn: Column<DashboardOrder> = {
  key: 'receipt',
  header: 'Receipt',
  render: (order) => <span className={classes.mono}>{order.invoiceId ?? '—'}</span>,
};

const whenColumn: Column<DashboardOrder> = {
  key: 'when',
  header: 'Date',
  render: (order) => <span className={classes.muted}>{formatWhen(order.createdAt)}</span>,
};

const totalColumn: Column<DashboardOrder> = {
  key: 'total',
  header: 'Total',
  align: 'end',
  render: (order) => <span className={classes.strong}>{formatMoney(order.total)}</span>,
};

const ORDER_COLUMNS: Column<DashboardOrder>[] = [
  receiptColumn,
  whenColumn,
  {
    key: 'method',
    header: 'Payment',
    render: (order) => {
      const method = paymentMethodOf(order.paymentMethod);
      return <Pill tone={method.tone}>{method.label}</Pill>;
    },
  },
  totalColumn,
];

const SPLIT_COLUMNS: Column<DashboardOrder>[] = [
  receiptColumn,
  whenColumn,
  { key: 'cash', header: 'Cash', align: 'end', render: (order) => formatMoney(order.splitCash) },
  { key: 'card', header: 'Card', align: 'end', render: (order) => formatMoney(order.splitCard) },
  totalColumn,
];

const EXPENSE_COLUMNS: Column<DashboardExpense>[] = [
  { key: 'date', header: 'Date', render: (expense) => <span className={classes.muted}>{formatDate(expense.date)}</span> },
  { key: 'title', header: 'Description', render: (expense) => expense.title || '—' },
  { key: 'category', header: 'Category', render: (expense) => <Pill tone="neutral">{expense.category || 'Other'}</Pill> },
  { key: 'amount', header: 'Amount', align: 'end', render: (expense) => <span className={classes.strong}>{formatMoney(expense.amount)}</span> },
];

type StockItem = DashboardKpis['breakdown']['lowStockItems'][number];

const STOCK_COLUMNS: Column<StockItem>[] = [
  { key: 'name', header: 'Product', render: (item) => <span className={classes.strong}>{item.name}</span> },
  { key: 'category', header: 'Category', render: (item) => <span className={classes.muted}>{item.category || '—'}</span> },
  { key: 'price', header: 'Price', align: 'end', render: (item) => formatMoney(item.price) },
  {
    key: 'stock',
    header: 'Stock',
    align: 'end',
    render: (item) => (item.stock <= 0 ? <Pill tone="bad">Out of stock</Pill> : <Pill tone="warn">{item.stock} left</Pill>),
  },
];

const stockKey = (item: StockItem, index: number) => `${item.name}-${index}`;

// ── Shared sections ─────────────────────────────────────────────────────────

function PaymentMix({ current }: { current: KpiTotals }) {
  if (current.cash + current.card <= 0) return <Empty>No sales yet this month.</Empty>;
  return (
    <ShareBar
      segments={[
        { label: 'Cash', value: current.cash, display: formatMoney(current.cash), color: PAYMENT_METHODS.cash.color },
        { label: 'Card', value: current.card, display: formatMoney(current.card), color: PAYMENT_METHODS.card.color },
      ]}
    />
  );
}

// ── Views ───────────────────────────────────────────────────────────────────

export function RevenueView({ kpis, orders }: DetailContext) {
  const { current, previous } = kpis;
  const average = (totals: KpiTotals) => (totals.orders > 0 ? totals.sales / totals.orders : 0);

  return (
    <>
      <StatGrid>
        <StatTile label="Revenue" value={formatMoney(current.sales)} trend={{ percent: change('sales', kpis) }} />
        <StatTile label="Orders" value={count(current.orders)} trend={{ percent: change('orders', kpis) }} />
        <StatTile
          label="Average order"
          value={formatMoney(average(current))}
          trend={{ percent: percentChange(average(current), average(previous)) }}
        />
      </StatGrid>
      <Section title="Daily revenue" aside="Last 30 days">
        <DailyChart series={dailySeries(kpis, 'sales')} color={PALETTE.brand} format={formatMoney} formatAxis={moneyAxis} />
      </Section>
      <Section title="Latest orders">
        <DataTable
          columns={ORDER_COLUMNS}
          rows={orders.slice(0, LATEST_ROWS)}
          rowKey={(order, index) => order.invoiceId ?? String(index)}
          empty="No sales yet."
        />
      </Section>
    </>
  );
}

export function ProfitView({ kpis }: DetailContext) {
  const { current } = kpis;
  const margin = percentOf(current.profit, current.sales);

  return (
    <>
      <StatGrid>
        <StatTile label="Revenue" value={formatMoney(current.sales)} trend={{ percent: change('sales', kpis) }} />
        <StatTile label="Expenses" value={formatMoney(current.expenses)} trend={{ percent: change('expenses', kpis), goodWhenUp: false }} />
        <StatTile
          label="Net profit"
          value={formatMoney(current.profit)}
          tone={current.profit < 0 ? 'bad' : undefined}
          trend={{ percent: change('profit', kpis) }}
        />
      </StatGrid>
      <Section title="Where revenue went" aside={`${margin.toFixed(1)}% profit margin`}>
        {current.sales > 0 ? (
          <ShareBar
            segments={[
              // Capped at revenue, so the two parts always add up to the whole bar.
              { label: 'Expenses', value: Math.min(current.expenses, current.sales), display: formatMoney(current.expenses), color: PALETTE.warn },
              { label: 'Profit', value: Math.max(current.profit, 0), display: formatMoney(current.profit), color: PALETTE.good },
            ]}
          />
        ) : (
          <Empty>No revenue yet this month.</Empty>
        )}
      </Section>
      <Section title="Daily profit" aside="Revenue minus expenses, last 30 days">
        <DailyChart series={dailySeries(kpis, 'profit')} color={PALETTE.good} format={formatMoney} formatAxis={moneyAxis} />
      </Section>
    </>
  );
}

export function ExpensesView({ kpis, expenses }: DetailContext) {
  const { current, breakdown } = kpis;
  const categories = breakdown.expenseCategories;

  return (
    <>
      <StatGrid>
        <StatTile label="Expenses" value={formatMoney(current.expenses)} trend={{ percent: change('expenses', kpis), goodWhenUp: false }} />
        <StatTile
          label="Share of revenue"
          value={`${percentOf(current.expenses, current.sales).toFixed(1)}%`}
          hint={`Of ${formatMoney(current.sales)} revenue`}
        />
        <StatTile label="Payments" value={count(breakdown.expenseCount)} hint={plural(categories.length, 'category', 'categories')} />
      </StatGrid>
      <Section title="By category" aside="Share of this month's expenses">
        {categories.length > 0 ? (
          <RankedList
            color={PALETTE.warn}
            scaleTo={current.expenses}
            items={categories.map((entry) => ({
              key: entry.category,
              label: entry.category,
              value: entry.total,
              display: formatMoney(entry.total),
              hint: plural(entry.count, 'payment', 'payments'),
            }))}
          />
        ) : (
          <Empty>No expenses this month.</Empty>
        )}
      </Section>
      <Section title="Daily expenses" aside="Last 30 days">
        <DailyChart series={dailySeries(kpis, 'expenses')} color={PALETTE.warn} format={formatMoney} formatAxis={moneyAxis} />
      </Section>
      <Section title="Latest expenses">
        <DataTable columns={EXPENSE_COLUMNS} rows={expenses.slice(0, LATEST_ROWS)} rowKey={(_, index) => String(index)} empty="No expenses recorded yet." />
      </Section>
    </>
  );
}

export function CashView({ kpis }: DetailContext) {
  const { current, breakdown } = kpis;
  const { payments } = breakdown;

  return (
    <>
      <StatGrid>
        <StatTile label="Cash sales" value={formatMoney(payments.cashOnly)} hint={plural(payments.cashOrders, 'sale', 'sales')} />
        <StatTile label="Cash part of split" value={formatMoney(payments.splitCash)} hint={plural(payments.splitOrders, 'split sale', 'split sales')} />
        <StatTile label="Total cash taken" value={formatMoney(current.cash)} trend={{ percent: change('cash', kpis) }} />
      </StatGrid>
      <Section title="Cash and card" aside="Share of this month's takings">
        <PaymentMix current={current} />
      </Section>
      <Section title="Daily cash" aside="Last 30 days">
        <DailyChart series={dailySeries(kpis, 'cash')} color={PALETTE.good} format={formatMoney} formatAxis={moneyAxis} />
      </Section>
    </>
  );
}

export function CardView({ kpis, orders }: DetailContext) {
  const { current, breakdown } = kpis;
  const { payments } = breakdown;

  return (
    <>
      <StatGrid>
        <StatTile label="Card sales" value={formatMoney(payments.cardOnly)} hint={plural(payments.cardOrders, 'sale', 'sales')} />
        <StatTile label="Card part of split" value={formatMoney(payments.splitCard)} hint={plural(payments.splitOrders, 'split sale', 'split sales')} />
        <StatTile label="Total card taken" value={formatMoney(current.card)} trend={{ percent: change('card', kpis) }} />
      </StatGrid>
      <Section title="Cash and card" aside="Share of this month's takings">
        <PaymentMix current={current} />
      </Section>
      <Section title="Daily card" aside="Last 30 days">
        <DailyChart series={dailySeries(kpis, 'card')} color={PALETTE.brand} format={formatMoney} formatAxis={moneyAxis} />
      </Section>
      <Section title="Latest split payments">
        <DataTable
          columns={SPLIT_COLUMNS}
          rows={orders.filter(isSplitPayment).slice(0, LATEST_ROWS)}
          rowKey={(order, index) => order.invoiceId ?? String(index)}
          empty="No split payments yet."
        />
      </Section>
    </>
  );
}

export function CustomersView({ kpis, customers }: DetailContext) {
  const { current, catalogue } = kpis;
  const buyers = customers.filter((customer) => (customer.timesVisited ?? 0) > 0).length;
  const top = [...customers].sort((a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0)).slice(0, TOP_CUSTOMERS);

  return (
    <>
      <StatGrid>
        <StatTile label="Registered" value={count(catalogue.customers)} hint="All time" />
        <StatTile label="New this month" value={count(current.newCustomers)} trend={{ percent: change('newCustomers', kpis) }} />
        <StatTile label="Have bought" value={count(buyers)} hint={`${percentOf(buyers, catalogue.customers).toFixed(0)}% of customers`} />
      </StatGrid>
      <Section title="New customers" aside="Last 30 days">
        <DailyChart series={dailySeries(kpis, 'newCustomers')} color={PALETTE.violet} format={count} formatAxis={count} kind="bars" />
      </Section>
      <Section title="Top customers" aside="By total spend">
        {top.length > 0 ? (
          <RankedList
            color={PALETTE.violet}
            items={top.map((customer, index) => ({
              key: `${customer.name}-${index}`,
              label: customer.name || 'Unnamed',
              value: customer.totalAmount ?? 0,
              display: formatMoney(customer.totalAmount),
              hint: plural(customer.timesVisited ?? 0, 'visit', 'visits'),
            }))}
          />
        ) : (
          <Empty>No customers yet.</Empty>
        )}
      </Section>
    </>
  );
}

export function ProductsView({ kpis }: DetailContext) {
  const { catalogue, breakdown } = kpis;

  return (
    <>
      <StatGrid>
        <StatTile label="Products" value={count(catalogue.products)} hint={`In ${plural(catalogue.categories, 'category', 'categories')}`} />
        <StatTile label="Low stock" value={count(catalogue.lowStock)} hint="10 units or fewer" />
        <StatTile
          label="Out of stock"
          value={count(catalogue.outOfStock)}
          tone={catalogue.outOfStock > 0 ? 'bad' : undefined}
          hint={catalogue.outOfStock > 0 ? 'Cannot be sold until restocked' : 'Everything can be sold'}
        />
      </StatGrid>
      <Section title="Best sellers" aside={`By revenue, ${currentPeriodLabel(kpis.periods)}`}>
        {breakdown.topProducts.length > 0 ? (
          <RankedList
            color={PALETTE.brand}
            items={breakdown.topProducts.map((product, index) => ({
              key: `${product.name}-${index}`,
              label: product.name,
              value: product.revenue,
              display: formatMoney(product.revenue),
              hint: `${count(product.quantity)} sold`,
            }))}
          />
        ) : (
          <Empty>No sales yet this month.</Empty>
        )}
      </Section>
      <Section title="Low stock">
        <DataTable columns={STOCK_COLUMNS} rows={breakdown.lowStockItems} rowKey={stockKey} empty="All products are well stocked." maxHeight={240} />
      </Section>
    </>
  );
}

export function LowStockView({ kpis }: DetailContext) {
  const { catalogue, breakdown } = kpis;

  return (
    <>
      <StatGrid>
        <StatTile label="Running low" value={count(catalogue.lowStock - catalogue.outOfStock)} hint="1 to 10 units left" />
        <StatTile label="Out of stock" value={count(catalogue.outOfStock)} tone={catalogue.outOfStock > 0 ? 'bad' : undefined} hint="None left to sell" />
        <StatTile label="To restock" value={count(catalogue.lowStock)} hint={`Of ${plural(catalogue.products, 'product', 'products')}`} />
      </StatGrid>
      <Section title="Products to restock" aside="Emptiest first">
        <DataTable columns={STOCK_COLUMNS} rows={breakdown.lowStockItems} rowKey={stockKey} empty="All products are well stocked." maxHeight={380} />
      </Section>
    </>
  );
}
