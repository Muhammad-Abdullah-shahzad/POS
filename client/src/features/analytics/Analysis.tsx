/**
 * Store analysis: six months of revenue and profit, best sellers, how
 * customers pay and where the money goes, laid over the artwork banner.
 */
import { useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@mantine/core';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ArtPanel from '../../components/ArtPanel';
import { formatMoneyAxis, niceTicks } from '../admin/chartFormat';
import { SeriesTooltip } from '../admin/ChartTooltip';
import { RankedList } from '../admin/details/blocks';
import { PALETTE } from '../admin/palette';
import { PAYMENT_METHODS, paymentMethodKey } from '../admin/paymentMethods';
import type { PaymentMethodKey } from '../admin/paymentMethods';
import api from '../../services/api';
import { formatMoney } from '../../utils/money';
import classes from './Analysis.module.css';

interface MonthlyData {
  /** e.g. "Sep 2026" */
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  orders: number;
}

interface TopProduct {
  name: string;
  totalQty: number;
  totalRevenue: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}

interface ExpenseBreakdown {
  category: string;
  total: number;
  count: number;
}

interface AnalysisData {
  monthly: MonthlyData[];
  topProducts: TopProduct[];
  payments: PaymentBreakdown[];
  expenses: ExpenseBreakdown[];
}

type Status = 'loading' | 'ready' | 'error';

const TOP_PRODUCTS = 6;
const AXIS_TICK = { fill: PALETTE.axis, fontSize: 12 };

const plural = (count: number, one: string, many: string): string => `${count.toLocaleString()} ${count === 1 ? one : many}`;
const shareOf = (part: number, whole: number): string => `${(whole > 0 ? (part / whole) * 100 : 0).toFixed(0)}%`;

async function fetchAnalysis(): Promise<AnalysisData> {
  const [summary, products, payments, expenses] = await Promise.all([
    api.get('/analytics/monthly-summary'),
    api.get('/analytics/top-products'),
    api.get('/analytics/payment-methods'),
    api.get('/analytics/expense-categories'),
  ]);

  return {
    monthly: summary.data.data?.monthly ?? [],
    topProducts: products.data.data ?? [],
    payments: payments.data.data ?? [],
    expenses: expenses.data.data ?? [],
  };
}

// ── Card frame ──────────────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  aside?: string;
  children: ReactNode;
}

function ChartCard({ title, aside, children }: ChartCardProps) {
  return (
    <section className={classes.card}>
      <header className={classes.cardHeader}>
        <h3 className={classes.cardTitle}>{title}</h3>
        {aside && <span className={classes.cardAside}>{aside}</span>}
      </header>
      <div className={classes.cardBody}>{children}</div>
    </section>
  );
}

const Status = ({ children }: { children: ReactNode }) => <p className={classes.status}>{children}</p>;

const swatch = (color: string) => ({ '--swatch-color': color }) as CSSProperties;

// ── Charts ──────────────────────────────────────────────────────────────────

const TREND_SERIES = [
  { key: 'revenue', label: 'Revenue', color: PALETTE.brand },
  { key: 'profit', label: 'Profit', color: PALETTE.good },
] as const;

function RevenueTrend({ monthly }: { monthly: MonthlyData[] }) {
  const gradientId = `trend-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (monthly.length === 0) return <Status>No sales in the last 6 months.</Status>;

  const ticks = niceTicks(monthly.flatMap((month) => [month.revenue, month.profit]));

  return (
    <>
      <ul className={classes.legend}>
        {TREND_SERIES.map((series) => (
          <li key={series.key}>
            <span className={classes.swatch} style={swatch(series.color)} />
            {series.label}
          </li>
        ))}
      </ul>
      <div className={classes.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE.brand} stopOpacity={0.2} />
                <stop offset="100%" stopColor={PALETTE.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={PALETTE.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickFormatter={(month: string) => month.split(' ')[0]}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              ticks={ticks}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              tickFormatter={formatMoneyAxis}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<SeriesTooltip format={formatMoney} />} cursor={{ stroke: PALETTE.axis, strokeDasharray: '3 3' }} isAnimationActive={false} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={PALETTE.brand}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="profit"
              name="Profit"
              stroke={PALETTE.good}
              strokeWidth={2}
              fill="none"
              activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

interface PaymentSlice {
  key: PaymentMethodKey;
  label: string;
  color: string;
  total: number;
  count: number;
}

/** Folds every stored spelling of a method, e.g. old "SPLIT (…)" rows, into one slice. */
function toPaymentSlices(rows: PaymentBreakdown[]): PaymentSlice[] {
  const slices = new Map<PaymentMethodKey, PaymentSlice>();
  for (const row of rows) {
    const key = paymentMethodKey(row.method);
    const method = PAYMENT_METHODS[key];
    const slice = slices.get(key) ?? { key, label: method.label, color: method.color, total: 0, count: 0 };
    slice.total += Number(row.total) || 0;
    slice.count += Number(row.count) || 0;
    slices.set(key, slice);
  }
  return [...slices.values()].sort((a, b) => b.total - a.total);
}

function PaymentDonut({ payments }: { payments: PaymentBreakdown[] }) {
  const slices = toPaymentSlices(payments);
  const total = slices.reduce((sum, slice) => sum + slice.total, 0);
  if (total <= 0) return <Status>No sales yet.</Status>;

  return (
    <div className={classes.donutLayout}>
      <div className={classes.donut}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="total" nameKey="label" innerRadius={64} outerRadius={92} paddingAngle={2} cornerRadius={4} stroke="none" isAnimationActive={false}>
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<SeriesTooltip format={formatMoney} />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
        <div className={classes.donutCenter}>
          <span className={classes.donutValue}>{formatMoneyAxis(total)}</span>
          <span className={classes.donutLabel}>Total taken</span>
        </div>
      </div>
      <ul className={classes.breakdown}>
        {slices.map((slice) => (
          <li key={slice.key} className={classes.breakdownItem}>
            <span className={classes.swatch} style={swatch(slice.color)} />
            <span className={classes.breakdownLabel}>
              {slice.label}
              <span className={classes.breakdownHint}>{plural(slice.count, 'sale', 'sales')}</span>
            </span>
            <span className={classes.breakdownValue}>{formatMoney(slice.total)}</span>
            <span className={classes.breakdownShare}>{shareOf(slice.total, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopSellers({ products }: { products: TopProduct[] }) {
  if (products.length === 0) return <Status>No sales yet.</Status>;
  return (
    <RankedList
      color={PALETTE.brand}
      items={products.slice(0, TOP_PRODUCTS).map((product, index) => ({
        key: `${product.name}-${index}`,
        label: product.name,
        value: product.totalRevenue,
        display: formatMoney(product.totalRevenue),
        hint: `${product.totalQty.toLocaleString()} sold`,
      }))}
    />
  );
}

function ExpenseCategories({ expenses }: { expenses: ExpenseBreakdown[] }) {
  const total = expenses.reduce((sum, entry) => sum + entry.total, 0);
  if (total <= 0) return <Status>No expenses recorded yet.</Status>;
  return (
    <RankedList
      color={PALETTE.warn}
      scaleTo={total}
      items={expenses.map((entry) => ({
        key: entry.category || 'Other',
        label: entry.category || 'Other',
        value: entry.total,
        display: formatMoney(entry.total),
        hint: `${shareOf(entry.total, total)} · ${plural(entry.count, 'payment', 'payments')}`,
      }))}
    />
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Analysis() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  // Bumped by "Try again" to run the request once more.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAnalysis()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        console.error('Analysis failed to load', error);
        if (!cancelled) setStatus('error');
      });
    // A late response after leaving the page is ignored.
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setStatus('loading');
    setAttempt((count) => count + 1);
  };

  const body = (content: (ready: AnalysisData) => ReactNode) => {
    if (status === 'loading') return <Status>Loading…</Status>;
    if (status === 'error' || !data) {
      return (
        <Status>
          This could not be loaded.{' '}
          <Button variant="default" size="compact-sm" radius={0} onClick={retry}>
            Try again
          </Button>
        </Status>
      );
    }
    return content(data);
  };

  return (
    <ArtPanel
      title="Store Analysis"
      subtitle="Six months of revenue and profit, your best sellers, how customers pay and where the money goes."
      backdropHeight="35vh"
    >
      <div className={classes.grid}>
        <ChartCard title="Revenue and profit" aside="Last 6 months, excluding VAT">
          {body((ready) => <RevenueTrend monthly={ready.monthly} />)}
        </ChartCard>
        <ChartCard title="Best sellers" aside="By revenue, all time">
          {body((ready) => <TopSellers products={ready.topProducts} />)}
        </ChartCard>
        <ChartCard title="Payment methods" aside="All time">
          {body((ready) => <PaymentDonut payments={ready.payments} />)}
        </ChartCard>
        <ChartCard title="Expenses by category" aside="All time">
          {body((ready) => <ExpenseCategories expenses={ready.expenses} />)}
        </ChartCard>
      </div>
    </ArtPanel>
  );
}
