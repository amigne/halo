import { getIconPath } from "@/shared/ui/icon-data";
import type { ListResponse } from "../api";

// ── Type badge colors ──────────────────────────────────────────────────────────

const TYPE_CLASS: Record<string, string> = {
  tasks: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  checklist: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  ideas: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  custom: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
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
      className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-surface hover:bg-border transition-colors text-left cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        <IconPreview iconKey={list.icon} />
        <span className="font-semibold text-text truncate">{list.title}</span>
      </div>

      <div className="flex items-center gap-2 mt-auto">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            TYPE_CLASS[list.list_type] ?? TYPE_CLASS.custom
          }`}
        >
          {typeLabel}
        </span>
        <span className="text-xs text-text-muted">#{list.ref_no}</span>
      </div>
    </button>
  );
}
