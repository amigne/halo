/**
 * Halo brand mark — ◎ icon used in Topbar and AuthLayout.
 *
 * A simple SVG circle-with-dot logo, rendered at the given size.
 */
export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 6a6 6 0 0 0-6 6c0 3.3 4 8 6 8s6-4.7 6-8a6 6 0 0 0-6-6z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
