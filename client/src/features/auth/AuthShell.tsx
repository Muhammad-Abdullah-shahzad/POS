/**
 * The frame around the sign in and sign up screens: a light background with
 * soft shapes, the cart mark, and a single centred column for the form.
 */
import type { ReactNode } from 'react';
import CartMark from '../../components/CartMark';
import classes from './AuthShell.module.css';

interface AuthShellProps {
  /** A short line under the mark, e.g. "Create your company account". */
  caption?: string;
  children: ReactNode;
}

/**
 * Brand blue shapes in the corners, with a softer halo of the same blue behind
 * each. They stay clear of the centre so the form never sits on colour.
 */
const SHAPE_COLOR = '#2350C9';

function Backdrop() {
  return (
    <svg className={classes.backdrop} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill={SHAPE_COLOR}>
        {/* Top right */}
        <path fillOpacity={0.1} d="M1440 0H980c-6 96 52 170 150 206 104 38 170 104 196 206 16 60 56 104 114 118V0z" />
        <path d="M1440 0H1100c-4 64 36 116 104 142 80 30 132 84 150 164 12 50 44 86 86 98V0z" />

        {/* Bottom left: concentric arcs */}
        <circle fillOpacity={0.08} cx="0" cy="900" r="400" />
        <circle fillOpacity={0.16} cx="0" cy="900" r="305" />
        <circle cx="0" cy="900" r="215" />

        {/* Bottom right */}
        <path fillOpacity={0.1} d="M1440 900V600c-110 8-196 72-228 170-14 44-14 88-4 130h232z" />
        <path d="M1440 900V700c-70 6-128 48-150 112-10 30-10 60-2 88h152z" />
      </g>
    </svg>
  );
}

export default function AuthShell({ caption, children }: AuthShellProps) {
  return (
    <main className={classes.page}>
      <Backdrop />
      <div className={classes.column}>
        <div className={classes.logo}>
          <CartMark />
        </div>
        {caption && <p className={classes.caption}>{caption}</p>}
        {children}
      </div>
    </main>
  );
}
