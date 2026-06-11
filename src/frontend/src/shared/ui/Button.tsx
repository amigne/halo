import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-contrast hover:opacity-90 focus-visible:ring-focus-ring",
  secondary:
    "bg-surface text-text border border-border hover:bg-border focus-visible:ring-focus-ring",
  danger:
    "bg-danger text-primary-contrast hover:opacity-90 focus-visible:ring-focus-ring",
  ghost:
    "bg-transparent text-text-muted hover:bg-surface focus-visible:ring-focus-ring",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs rounded-sm min-h-[44px] min-w-[44px]",
  md: "px-4 py-2 text-sm rounded-md min-h-[44px] min-w-[44px]",
  lg: "px-6 py-3 text-base rounded-lg min-h-[44px] min-w-[44px]",
};

/**
 * Accessible button consuming design tokens.
 *
 * - Variants: primary, secondary, danger, ghost
 * - `loading` displays Spinner + disables the button + sets aria-busy
 * - Touch target ≥ 44×44px (U-014)
 * - Focus-visible ring uses `--color-focus-ring`
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const { t } = useTranslation();

  const isDisabled = disabled || loading;

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {loading ? (
        <span className="sr-only">{t("ui.button.loading")}</span>
      ) : null}
      {children}
    </button>
  );
}
