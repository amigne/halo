interface SkeletonProps {
  /** Additional CSS classes (e.g. height, width). */
  className?: string;
}

/**
 * Reusable skeleton placeholder for loading states.
 *
 * - Renders a pulsing block using `bg-surface-muted`
 * - Intended for lists, cards, and text placeholders
 * - Use Spinner for action-level loading; Skeleton for content-level
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-muted rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/** Pre-configured skeleton shapes for common use cases. */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-4 w-full rounded ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-32 w-full rounded-lg ${className}`} />;
}

export function SkeletonCircle({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-10 w-10 rounded-full ${className}`} />;
}
