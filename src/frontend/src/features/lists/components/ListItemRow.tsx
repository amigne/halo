import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeVariant } from "@/shared/ui/Badge";
import { getIconPath } from "@/shared/ui/icon-data";
import { formatDateTime } from "@/shared/datetime/format";
import type { ListItemResponse } from "../api";

// ── Priority helpers ───────────────────────────────────────────────────────────

function getPriorityLabel(
  priority: number | null | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (priority == null) return "";
  const keys = [
    "lists.item.priorityLow",
    "lists.item.priorityMedium",
    "lists.item.priorityHigh",
    "lists.item.priorityUrgent",
  ];
  return t(keys[priority] ?? "");
}

const PRIORITY_VARIANT: Record<number, BadgeVariant> = {
  0: "neutral",
  1: "primary",
  2: "warning",
  3: "danger",
};

// ── Due date helpers ───────────────────────────────────────────────────────────

function isOverdue(dueAt: string | null | undefined): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

// ── Tiny SVG icon renderer (16px) ──────────────────────────────────────────────

function SvgIcon({ d, label }: { d: string; label?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      aria-label={label}
    >
      <path d={d} />
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface ListItemRowProps {
  item: ListItemResponse;
  fieldSchema: Array<{ key: string; type: string; required?: boolean }>;
  timezone: string;
  /** Called when the is_done checkbox is toggled. */
  onToggleDone: (itemId: string, checked: boolean) => void;
  /** Called when the row is clicked (to open the item modal). */
  onClick: (itemId: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Read-only item row displayed in the list detail modal.
 *
 * - Checkbox to toggle is_done (immediate save, no modal)
 * - Title — strikethrough + muted when done
 * - Priority badge (only if field exists AND value is set)
 * - Due date chip with icon (red if overdue)
 * - Click on row → opens dedicated item modal
 */
export function ListItemRow({
  item,
  fieldSchema,
  timezone,
  onToggleDone,
  onClick,
}: ListItemRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const schemaMap = new Map(fieldSchema.map((f) => [f.key, f]));
  const hasField = (key: string) => schemaMap.has(key);

  const handleToggleDone = useCallback(
    (e: React.MouseEvent | React.ChangeEvent) => {
      e.stopPropagation();
      onToggleDone(item.id, !item.is_done);
    },
    [item.id, item.is_done, onToggleDone],
  );

  return (
    <div className="relative flex items-center gap-3 py-2 group">
      {/* is_done checkbox — sits above the title's stretched overlay (z-10) so
          toggling it doesn't open the item modal. */}
      {hasField("is_done") && (
        <input
          type="checkbox"
          checked={item.is_done}
          onChange={handleToggleDone}
          className="relative z-10 h-5 w-5 shrink-0 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
          aria-label={t("lists.item.done")}
        />
      )}

      {/* Title — a stretched-link button: its ::after overlay covers the whole
          row so a click anywhere (except the checkbox) opens the item modal.
          Keyboard-accessible, no nested role=button container (U-123). */}
      <button
        type="button"
        onClick={() => onClick(item.id)}
        aria-label={`${t("lists.item.edit")} : ${item.title}`}
        className={`flex-1 min-w-0 truncate text-left text-sm rounded after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 ${
          item.is_done ? "line-through text-text-muted" : "text-text"
        }`}
      >
        {item.title || " "}
      </button>

      {/* Priority badge */}
      {item.priority != null && hasField("priority") && (
        <Badge
          variant={PRIORITY_VARIANT[item.priority] ?? "neutral"}
          className="shrink-0"
        >
          {getPriorityLabel(item.priority, t)}
        </Badge>
      )}

      {/* Due date chip */}
      {item.due_at && hasField("due_at") && (
        <span
          className={`inline-flex items-center gap-1 text-xs shrink-0 ${
            isOverdue(item.due_at) ? "text-danger font-medium" : "text-text-muted"
          }`}
        >
          <SvgIcon d={getIconPath("calendar")!} />
          <span>
            {formatDateTime(item.due_at, timezone, lang, {
              month: "short",
              day: "numeric",
            })}
          </span>
          {isOverdue(item.due_at) && (
            <span className="sr-only">{t("lists.item.overdue")}</span>
          )}
        </span>
      )}

      {/* Chevron hint */}
      <span className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true">
        <SvgIcon d={getIconPath("chevron-right")!} />
      </span>
    </div>
  );
}
