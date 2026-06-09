import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Optional icon element (SVG, etc.). */
  icon?: ReactNode;
  /** Title text (required). */
  title: string;
  /** Optional description text. */
  description?: string;
  /** Optional action slot (e.g., a `<Button>`). */
  action?: ReactNode;
}

/**
 * Empty state placeholder with icon, title, description, and optional action.
 *
 * - Centered layout with generous spacing
 * - Uses `--color-text-muted` for description
 * - Action slot for a call-to-action button (U-130)
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
      {icon && (
        <div className="text-text-muted" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      {description && (
        <p className="max-w-md text-sm text-text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
