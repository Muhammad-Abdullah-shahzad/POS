/**
 * Month-on-month movement rules shared by the KPI cards and their detail
 * views: when a change counts as flat, and whether it is good news.
 */

export type Tone = 'good' | 'bad' | 'neutral';

export interface KpiTrend {
  /** Change against last month in percent; null when last month had nothing. */
  percent: number | null;
  /** False for costs, where a rise is bad news. */
  goodWhenUp?: boolean;
}

/** Changes smaller than this read as "no change". */
const FLAT_THRESHOLD = 0.05;

export const isFlat = (percent: number): boolean => Math.abs(percent) < FLAT_THRESHOLD;

export function toneOf(trend: KpiTrend): Tone {
  if (trend.percent === null || isFlat(trend.percent)) return 'neutral';
  return trend.percent > 0 === (trend.goodWhenUp ?? true) ? 'good' : 'bad';
}
