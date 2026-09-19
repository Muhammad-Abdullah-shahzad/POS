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
 * Brand blue shapes pinned to three corners of the screen, each with a softer
 * halo of the same blue. Each corner is its own small drawing sized from the
 * viewport, so the shapes stay in their corners on any screen, phone or wall.
 */
function CornerShapes() {
  return (
    <>
      <svg className={`${classes.shape} ${classes.topRight}`} viewBox="0 0 100 100" aria-hidden="true">
        <path fillOpacity={0.12} d="M100 0H14c-2 20 9 35 29 43 20 8 32 21 37 41 3 9 10 15 20 16V0z" />
        <path d="M100 0H42c-1 13 7 23 20 29 15 6 24 16 28 31 2 9 5 14 10 16V0z" />
      </svg>
      <svg className={`${classes.shape} ${classes.bottomLeft}`} viewBox="0 0 100 100" aria-hidden="true">
        <circle fillOpacity={0.1} cx="0" cy="100" r="100" />
        <circle fillOpacity={0.18} cx="0" cy="100" r="76" />
        <circle cx="0" cy="100" r="54" />
      </svg>
      <svg className={`${classes.shape} ${classes.bottomRight}`} viewBox="0 0 100 100" aria-hidden="true">
        <path fillOpacity={0.12} d="M100 100V26C72 28 52 45 45 69c-3 11-3 21-1 31h56z" />
        <path d="M100 100V54c-17 2-29 12-34 27-2 7-2 13-1 19h35z" />
      </svg>
    </>
  );
}

export default function AuthShell({ caption, children }: AuthShellProps) {
  return (
    <main className={classes.page}>
      <CornerShapes />
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
