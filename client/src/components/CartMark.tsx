/** The product mark: a thin outline cart with an upward arrow in the basket. */
interface CartMarkProps {
  /** Width in pixels; the height follows the mark's proportions. */
  size?: number;
  /** Stroke width in the mark's own 80 x 68 units. Raise it at small sizes. */
  strokeWidth?: number;
  title?: string;
}

export default function CartMark({ size = 92, strokeWidth = 2, title = 'POS' }: CartMarkProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 68) / 80)}
      viewBox="0 0 80 68"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
    >
      <path d="M4 8h8l12 38h34l8-26h6" />
      <path d="M41 38V20" />
      <path d="M34 27l7-7 7 7" />
      <circle cx="30" cy="56" r="3.5" />
      <circle cx="52" cy="56" r="3.5" />
    </svg>
  );
}
