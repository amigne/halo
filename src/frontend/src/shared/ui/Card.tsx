import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** When true, adds hover shadow + transition, and makes the card focusable. */
  interactive?: boolean;
}

/**
 * Card surface consuming the `.card` design token class.
 *
 * - Wraps children in a styled container (bg-surface, border, radius, shadow)
 * - `interactive` variant adds hover elevation + focus ring for clickable cards
 */
export function Card({
  children,
  interactive = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`card p-4 ${interactive ? "hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1" : ""} ${className}`}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    >
      {children}
    </div>
  );
}
