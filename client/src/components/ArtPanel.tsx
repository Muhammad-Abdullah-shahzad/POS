/**
 * A titled panel on the lavender artwork background, shared by the dashboard
 * overview and the analysis page so both stay in the same design.
 *
 *   <ArtPanel title="Business Overview" subtitle="…">cards</ArtPanel>
 *   <ArtPanel title="Store Analysis" backdropHeight="35vh">charts</ArtPanel>
 *
 * With backdropHeight the artwork becomes a banner of that height and the
 * content flows on past it, overlapping its lower part.
 */
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
// Vector artwork, so it stays sharp however large the panel draws it.
import coil from '../assets/kpi-coil.svg';
import classes from './ArtPanel.module.css';

interface ArtPanelProps {
  title: string;
  subtitle?: ReactNode;
  /** Any CSS length; the artwork fills the whole panel when omitted. */
  backdropHeight?: string;
  children?: ReactNode;
}

export default function ArtPanel({ title, subtitle, backdropHeight, children }: ArtPanelProps) {
  const titleId = useId();
  const style = backdropHeight ? ({ '--art-panel-backdrop-height': backdropHeight } as CSSProperties) : undefined;

  return (
    <section className={classes.root} style={style} aria-labelledby={titleId}>
      <div className={classes.backdrop} aria-hidden="true">
        <img src={coil} alt="" className={`${classes.art} ${classes.artMain}`} />
        <img src={coil} alt="" className={`${classes.art} ${classes.artEcho}`} />
      </div>

      <header className={classes.header}>
        <h2 id={titleId} className={classes.title}>
          {title}
        </h2>
        {subtitle && <p className={classes.subtitle}>{subtitle}</p>}
      </header>

      {children}
    </section>
  );
}
