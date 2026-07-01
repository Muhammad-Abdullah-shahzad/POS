/**
 * Rendering constants. The nav-graph is authored in metres; the marker defines
 * a local AR space whose unit roughly matches the printed marker's width. We
 * scale building metres down so a multi-metre route fits comfortably around the
 * marker on a table or floor. Tune this for your physical marker size.
 */
export const METERS_TO_WORLD = 0.12;

/** Arrows float just above the floor plane to avoid z-fighting with the path. */
export const ARROW_HEIGHT = 0.02;

/** Spacing between repeated arrows along a leg, in world units. */
export const ARROW_SPACING = 0.18;

export const COLORS = {
  arrow: 0x38bdf8,
  arrowHead: 0x7dd3fc,
  path: 0x0ea5e9,
  destination: 0xf472b6,
} as const;
