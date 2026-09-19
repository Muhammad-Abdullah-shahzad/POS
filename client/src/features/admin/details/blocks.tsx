/**
 * Building blocks for the KPI detail views: stat tiles, titled sections, a
 * share bar, a ranked list and status pills. Styled in DetailModal.module.css.
 */
import type { CSSProperties, ReactNode } from 'react';
import { TrendLine } from '../KpiTrend';
import type { KpiTrend } from '../trend';
import classes from './DetailModal.module.css';

/** Status colours for pills; each maps to a tint in the stylesheet. */
export type PillTone = 'brand' | 'good' | 'bad' | 'warn' | 'violet' | 'neutral';

const share = (part: number, whole: number): number => (whole > 0 ? (part / whole) * 100 : 0);
const formatShare = (percent: number): string => `${percent.toFixed(percent > 0 && percent < 10 ? 1 : 0)}%`;

// ── Stat tiles ──────────────────────────────────────────────────────────────

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={classes.statGrid}>{children}</div>;
}

interface StatTileProps {
  label: string;
  value: string;
  /** Month-on-month movement, shown under the value. */
  trend?: KpiTrend;
  /** Shown when there is no trend, e.g. "393 sales". */
  hint?: string;
  /** Colours the value, e.g. a loss in red. */
  tone?: 'good' | 'bad';
}

export function StatTile({ label, value, trend, hint, tone }: StatTileProps) {
  return (
    <div className={classes.tile}>
      <div className={classes.tileLabel}>{label}</div>
      <div className={classes.tileValue} data-tone={tone}>
        {value}
      </div>
      {trend ? <TrendLine trend={trend} size="sm" /> : hint && <p className={classes.tileHint}>{hint}</p>}
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  /** Right-aligned context, e.g. "Last 30 days". */
  aside?: string;
  children: ReactNode;
}

export function Section({ title, aside, children }: SectionProps) {
  return (
    <section className={classes.section}>
      <header className={classes.sectionHeader}>
        <h3 className={classes.sectionTitle}>{title}</h3>
        {aside && <span className={classes.sectionAside}>{aside}</span>}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={classes.empty}>{children}</p>;
}

// ── Share bar ───────────────────────────────────────────────────────────────

export interface ShareSegment {
  label: string;
  value: number;
  display: string;
  color: string;
}

/** How a whole splits into parts, e.g. cash against card. */
export function ShareBar({ segments }: { segments: ShareSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);

  return (
    <>
      <div className={classes.shareBar} role="img" aria-label={segments.map((s) => `${s.label} ${formatShare(share(s.value, total))}`).join(', ')}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.label}
              className={classes.shareSegment}
              style={{ width: `${share(segment.value, total)}%`, '--segment-color': segment.color } as CSSProperties}
            />
          ))}
      </div>
      <ul className={classes.legend}>
        {segments.map((segment) => (
          <li key={segment.label} className={classes.legendItem} style={{ '--segment-color': segment.color } as CSSProperties}>
            <span className={classes.swatch} />
            <span className={classes.legendLabel}>{segment.label}</span>
            <span className={classes.legendValue}>{segment.display}</span>
            <span className={classes.legendShare}>{formatShare(share(segment.value, total))}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Ranked list ─────────────────────────────────────────────────────────────

export interface RankedItem {
  key: string;
  label: string;
  value: number;
  display: string;
  /** Secondary detail beside the label, e.g. "12 sold". */
  hint?: string;
}

interface RankedListProps {
  items: RankedItem[];
  color: string;
  /** Bars are relative to this; defaults to the largest item. */
  scaleTo?: number;
}

/** Items with a bar each, e.g. best sellers or spend by category. */
export function RankedList({ items, color, scaleTo }: RankedListProps) {
  const max = scaleTo ?? Math.max(0, ...items.map((item) => item.value));

  return (
    <ol className={classes.ranked} style={{ '--bar-color': color } as CSSProperties}>
      {items.map((item) => (
        <li key={item.key} className={classes.rankRow}>
          <span className={classes.rankLabel}>
            {item.label}
            {item.hint && <span className={classes.rankHint}>{item.hint}</span>}
          </span>
          <span className={classes.rankValue}>{item.display}</span>
          <span className={classes.rankTrack} aria-hidden="true">
            <span className={classes.rankFill} style={{ width: `${share(item.value, max)}%`, display: 'block' }} />
          </span>
        </li>
      ))}
    </ol>
  );
}

// ── Pills ───────────────────────────────────────────────────────────────────

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={classes.pill} data-tone={tone}>
      {children}
    </span>
  );
}
