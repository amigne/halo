import { useTranslation } from "react-i18next";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
};

/**
 * Accessible loading spinner consuming design tokens.
 *
 * - `role="status"` + i18n `aria-label` for screen readers
 * - Respects `prefers-reduced-motion` via the global CSS rule + Tailwind variant
 * - Sizes: sm=16px, md=32px, lg=48px
 */
export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-label={t("ui.spinner.loading")}
      className={`animate-spin motion-reduce:animate-none rounded-full border-t-transparent border-primary ${sizeClasses[size]} ${className}`}
    />
  );
}
