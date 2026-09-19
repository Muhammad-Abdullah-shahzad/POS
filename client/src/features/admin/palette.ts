/**
 * Colours for charts, which need plain values rather than CSS variables.
 * Keep in step with the tokens in src/styles/tokens.css.
 */
import type { Tone } from './trend';

export const PALETTE = {
  brand: '#2350c9',
  good: '#16a34a',
  bad: '#dc2626',
  warn: '#f79009',
  violet: '#7a5af8',
  grid: '#eef0f4',
  axis: '#98a2b3',
  guide: '#d0d5dd',
} as const;

/** The line colour for a card or chart, by how its figure moved. */
export const TONE_COLOR: Record<Tone, string> = {
  good: PALETTE.good,
  bad: PALETTE.bad,
  neutral: PALETTE.brand,
};
