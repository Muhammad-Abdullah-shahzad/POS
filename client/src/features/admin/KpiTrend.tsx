/** "▲ 12.5% from last month", on KPI cards and in their detail views. */
import { IconTriangleFilled, IconTriangleInvertedFilled } from '@tabler/icons-react';
import { isFlat, toneOf } from './trend';
import type { KpiTrend } from './trend';
import classes from './KpiTrend.module.css';

interface TrendLineProps {
  trend: KpiTrend;
  size?: 'md' | 'sm';
}

export function TrendLine({ trend, size = 'md' }: TrendLineProps) {
  const { percent } = trend;

  if (percent === null) {
    return (
      <p className={classes.change} data-size={size}>
        Nothing to compare with last month
      </p>
    );
  }

  const flat = isFlat(percent);
  const Arrow = percent > 0 ? IconTriangleFilled : IconTriangleInvertedFilled;
  return (
    <p className={classes.change} data-size={size}>
      <span className={classes.delta} data-tone={toneOf(trend)}>
        {!flat && <Arrow size={size === 'sm' ? 10 : 11} aria-label={percent > 0 ? 'Up' : 'Down'} />}
        {flat ? '0%' : `${Math.abs(percent).toFixed(1)}%`}
      </span>
      <span className={classes.since}>from last month</span>
    </p>
  );
}
