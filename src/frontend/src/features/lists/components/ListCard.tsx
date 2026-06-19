import { Badge, type BadgeVariant } from "@/shared/ui/Badge";
import { getIconPath } from "@/shared/ui/icon-data";
import type { ListResponse } from "../api";

// ── Type → badge variant mapping ───────────────────────────────────────────────

const TYPE_VARIANT: Record<string, BadgeVariant> = {
  tasks: "primary",
  checklist: "success",
  ideas: "warning",
  custom: "neutral",
};

// ── Small icon renderer ────────────────────────────────────────────────────────

function IconPreview({ iconKey }: { iconKey: string | null }) {
  const path = iconKey ? getIconPath(iconKey) : null;
  return (
    <div
      className="flex items-center justify-center w-10 h-10 rounded-md border border-border bg-surface shrink-0"
      aria-hidden="true"
    >
      {path ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={path} />
        </svg>
      ) : (
        <span className="text-lg text-text-muted opacity-40">+</span>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ListCardProps {
  list: ListResponse;
  typeLabel: string;
  onClick: (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListCard — a clickable card representing a single list in the grid.
 *
 * Displays: icon, title, type badge, and reference number.
 */
export function ListCard({ list, typeLabel, onClick }: ListCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(list.id)}
      className="card flex flex-col gap-3 p-4 hover:bg-border transition-colors text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <IconPreview iconKey={list.icon} />
        <span className="font-semibold text-text truncate">{list.title}</span>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <Badge variant={TYPE_VARIANT[list.list_type] ?? "neutral"}>
          {typeLabel}
        </Badge>
        <span className="text-xs text-text-muted">#{list.ref_no}</span>
      </div>
    </button>
  );
}
