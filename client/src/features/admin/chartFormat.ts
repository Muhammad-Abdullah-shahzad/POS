/** Formatting shared by the dashboard and analysis charts. */
import { formatMoneyCompact, formatMoneyWhole } from '../../utils/money';

/** Short amounts for chart axes: "€250", "€1.5K". */
export const formatMoneyAxis = (value: number): string =>
  Math.abs(value) < 1000 ? formatMoneyWhole(value) : formatMoneyCompact(value);

export interface DayPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

const longDay = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const shortDay = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/** "Sat, Sep 14" (long) or "Sep 14" (short), read as a local calendar day. */
export function formatDay(date: string, style: 'long' | 'short' = 'long'): string {
  const [year, month, day] = date.split('-').map(Number);
  return (style === 'long' ? longDay : shortDay).format(new Date(year, month - 1, day));
}

const NICE_STEPS = [1, 2, 2.5, 5, 10];

/**
 * Round, evenly spaced axis values covering the data and zero, e.g. 0, 100,
 * 200, 300. Whole numbers only when the data is a count.
 */
export function niceTicks(values: number[], { count = 4, integers = false } = {}): number[] {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  if (max === min) return [0, 1];

  const rough = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  let step = NICE_STEPS.map((multiple) => multiple * magnitude).find((candidate) => candidate >= rough) ?? rough;
  if (integers) step = Math.max(1, Math.ceil(step));

  const first = Math.floor(min / step) * step;
  const last = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= last + step / 2; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}
