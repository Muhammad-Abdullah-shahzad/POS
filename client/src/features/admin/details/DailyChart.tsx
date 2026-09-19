/**
 * A day-by-day chart in the sparkline's style, with axes and the same hover
 * tooltip, for the detail views. Amounts draw as an area; small counts draw
 * as bars, since a smooth line would suggest values between whole numbers.
 */
import { useId } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDay, niceTicks } from '../chartFormat';
import type { DayPoint } from '../chartFormat';
import { DayTooltip } from '../ChartTooltip';
import { PALETTE } from '../palette';
import classes from './DetailModal.module.css';

interface DailyChartProps {
  series: DayPoint[];
  color: string;
  /** Exact value in the tooltip. */
  format: (value: number) => string;
  /** Short value on the axis. */
  formatAxis: (value: number) => string;
  /** "bars" for counts: whole-number steps, one bar a day. */
  kind?: 'area' | 'bars';
}

const AXIS_TICK = { fill: PALETTE.axis, fontSize: 12 };
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };

export default function DailyChart({ series, color, format, formatAxis, kind = 'area' }: DailyChartProps) {
  const gradientId = `daily-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const values = series.map((point) => point.value);
  const ticks = niceTicks(values, { integers: kind === 'bars' });
  const hasNegative = values.some((value) => value < 0);

  // Shared by both chart kinds; recharts reads them as direct children.
  const frame = [
    <CartesianGrid key="grid" vertical={false} stroke={PALETTE.grid} strokeDasharray="3 3" />,
    <XAxis
      key="x"
      dataKey="date"
      tickFormatter={(date: string) => formatDay(date, 'short')}
      tick={AXIS_TICK}
      axisLine={false}
      tickLine={false}
      tickMargin={8}
      interval="preserveStartEnd"
      minTickGap={28}
    />,
    <YAxis
      key="y"
      ticks={ticks}
      domain={[ticks[0], ticks[ticks.length - 1]]}
      tickFormatter={formatAxis}
      tick={AXIS_TICK}
      axisLine={false}
      tickLine={false}
      width={60}
    />,
    hasNegative && <ReferenceLine key="zero" y={0} stroke={PALETTE.guide} />,
    <Tooltip
      key="tooltip"
      content={<DayTooltip format={format} />}
      cursor={kind === 'bars' ? { fill: 'rgba(16, 24, 40, 0.04)' } : { stroke: PALETTE.axis, strokeDasharray: '3 3' }}
      isAnimationActive={false}
    />,
  ];

  return (
    <div className={classes.chart}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bars' ? (
          <BarChart data={series} margin={MARGIN}>
            {frame}
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        ) : (
          <AreaChart data={series} margin={MARGIN}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {frame}
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: '#ffffff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
