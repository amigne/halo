import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

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
  sm: "px-2.5 py-1 text-xs rounded",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-6 py-3 text-base rounded-lg",
  icon:
    "h-9 w-9 rounded-md [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
};

/**
 * Accessible button consuming design tokens.
 *
 * - Variants: primary, secondary, danger, ghost
 * - Sizes: sm, md, lg, icon (icon = 36px fine pointer, 44px coarse pointer)
 * - `loading` displays Spinner + disables the button + sets aria-busy
 * - Touch target ≥ 44px on coarse pointers only (U-014)
 * - Fine pointer: natural height (~32-40px), no forced minimum
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
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer [@media(pointer:coarse)]:min-h-11 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
