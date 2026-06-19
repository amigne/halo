import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * When true, adds hover elevation (visual only). The card itself is NOT made
   * focusable/role=button: clickable cards must host their own real control
   * (a `<button>`/`<Link>`, e.g. via a stretched-link) so keyboard and screen
   * reader users get a proper, non-nested interactive element (U-121/U-123).
   */
  interactive?: boolean;
}

/**
 * Card surface consuming the `.card` design token class.
 *
 * - Wraps children in a styled container (bg-surface, border, radius, shadow)
 * - `interactive` variant only adds hover elevation; accessibility comes from
 *   the consumer's own interactive child element.
 */
export function Card({
  children,
  interactive = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`card p-4 ${interactive ? "hover:shadow-md transition-shadow" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
