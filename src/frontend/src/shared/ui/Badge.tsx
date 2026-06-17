import type { ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--badge-neutral-bg)] text-[var(--badge-neutral-text)]",
  primary: "bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)]",
  success: "bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]",
  warning: "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]",
  danger: "bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)]",
  info: "bg-[var(--badge-info-bg)] text-[var(--badge-info-text)]",
};

/**
 * Inline badge/chip for status, type, or category labelling.
 *
 * - Variants: neutral, primary, success, warning, danger, info
 * - Colours switch automatically with theme via CSS custom properties
 *   (light: 50 bg / 700 text; dark: 900 at 40% bg / 300 text)
 */
export function Badge({
  variant = "neutral",
  children,
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
