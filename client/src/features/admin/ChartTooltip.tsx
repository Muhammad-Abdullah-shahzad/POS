/** Hover tooltips for the dashboard and analysis charts, in one dark style. */
import { formatDay } from './chartFormat';
import type { DayPoint } from './chartFormat';
import classes from './ChartTooltip.module.css';

interface DayTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: DayPoint }>;
  format: (value: number) => string;
}

export function DayTooltip({ active, payload, format }: DayTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className={classes.tip}>
      <span className={classes.date}>{formatDay(point.date)}</span>
      <span className={classes.value}>{format(point.value)}</span>
    </div>
  );
}

interface SeriesTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string | number; value?: number | string; color?: string; payload?: { fill?: string } }>;
  format: (value: number) => string;
}

/** A heading (e.g. the month) and one row per series or slice, with its colour. */
export function SeriesTooltip({ active, label, payload, format }: SeriesTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={classes.tip}>
      {label !== undefined && label !== '' && <span className={classes.date}>{label}</span>}
      {payload.map((entry) => (
        <span key={String(entry.name)} className={classes.row}>
          <span className={classes.swatch} style={{ background: entry.color ?? entry.payload?.fill }} />
          <span>{entry.name}</span>
          <span className={classes.value}>{format(Number(entry.value))}</span>
        </span>
      ))}
    </div>
  );
}
