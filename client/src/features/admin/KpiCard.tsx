/**
 * A dashboard KPI card: the figure, how it moved against last month, and a
 * 30 day sparkline with its best day marked.
 */
import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { Tooltip } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { Area, AreaChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import type { DayPoint } from './chartFormat';
import { DayTooltip } from './ChartTooltip';
import { TrendLine } from './KpiTrend';
import { toneOf } from './trend';
import type { KpiTrend } from './trend';
import { PALETTE, TONE_COLOR } from './palette';
import classes from './KpiCard.module.css';

export interface KpiCardProps {
  title: string;
  /** Shown from the info icon: what the figure counts and over which period. */
  info: string;
  value: string;
  /** Month-on-month movement. Omit for snapshot figures such as stock counts. */
  trend?: KpiTrend;
  /** Shown instead of a trend for snapshot figures. */
  footnote?: string;
  /** Daily values for the sparkline, oldest first. */
  series?: DayPoint[];
  /** Formats the best day's label on the sparkline. */
  formatPoint?: (value: number) => string;
  /** Formats a day's exact value in the hover tooltip. */
  formatExact?: (value: number) => string;
  /** Frosted, for cards laid over artwork. */
  glass?: boolean;
  onClick?: () => void;
}

interface SparklineProps {
  series: DayPoint[];
  color: string;
  formatPoint: (value: number) => string;
  formatExact: (value: number) => string;
}

function Sparkline({ series, color, formatPoint, formatExact }: SparklineProps) {
  const gradientId = `kpi-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const data = series.map((point, index) => ({ ...point, index }));
  const values = series.map((point) => point.value);

  const max = Math.max(...values);
  const min = Math.min(...values);
  const peakIndex = values.lastIndexOf(max);
  const hasPeak = max > 0;
  const padding = (max - min) * 0.15 || 1;

  // Keep the label inside the chart when the best day is near an edge.
  const position = peakIndex / Math.max(values.length - 1, 1);
  const anchor = position > 0.7 ? 'end' : position < 0.3 ? 'start' : 'middle';

  const renderPeakLabel = ({ viewBox }: { viewBox?: { x?: number; y?: number; width?: number } }) => {
    if (!viewBox) return null;
    const x = (viewBox.x ?? 0) + (viewBox.width ?? 0) / 2;
    return (
      <text x={x} y={(viewBox.y ?? 0) - 8} textAnchor={anchor} fill={color} fontSize={12} fontWeight={600}>
        {formatPoint(max)}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 22, right: 6, bottom: 2, left: 6 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="index" type="number" domain={['dataMin', 'dataMax']} hide />
        <YAxis domain={[min - padding, max + padding]} hide />
        {hasPeak && <ReferenceLine x={peakIndex} stroke={PALETTE.guide} strokeDasharray="3 3" />}
        {hasPeak && <ReferenceLine y={max} stroke={PALETTE.grid} strokeDasharray="3 3" />}
        <ChartTooltip
          content={<DayTooltip format={formatExact} />}
          cursor={{ stroke: PALETTE.axis, strokeDasharray: '3 3' }}
          allowEscapeViewBox={{ x: true, y: true }}
          wrapperStyle={{ zIndex: 5 }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3.5, fill: color, stroke: '#ffffff', strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
        {hasPeak && (
          <ReferenceDot x={peakIndex} y={max} r={4} fill="#ffffff" stroke={color} strokeWidth={2} label={renderPeakLabel} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function KpiCard({ title, info, value, trend, footnote, series, formatPoint, formatExact, glass, onClick }: KpiCardProps) {
  const interactive = Boolean(onClick);
  const color = TONE_COLOR[trend ? toneOf(trend) : 'neutral'];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={classes.card}
      data-glass={glass || undefined}
      data-interactive={interactive || undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <div className={classes.header}>
        <span className={classes.title}>{title}</span>
        <Tooltip label={info} multiline w={250} withArrow position="top-end">
          <span className={classes.info} aria-label={`About ${title}`} onClick={(event) => event.stopPropagation()}>
            <IconInfoCircle size={18} stroke={1.6} />
          </span>
        </Tooltip>
      </div>

      <div className={classes.body}>
        <div className={classes.figures}>
          <div className={classes.value}>{value}</div>
          {trend ? <TrendLine trend={trend} /> : footnote && <p className={classes.footnote}>{footnote}</p>}
        </div>

        {series && series.length > 1 && (
          <div className={classes.chart} aria-hidden="true">
            <Sparkline series={series} color={color} formatPoint={formatPoint ?? String} formatExact={formatExact ?? formatPoint ?? String} />
          </div>
        )}
      </div>
    </div>
  );
}
