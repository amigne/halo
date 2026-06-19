import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Badge, type BadgeVariant } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
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
  /** Opens the list items modal. */
  onOpen: (id: string) => void;
  /** Opens the edit-list modal. */
  onEdit: (id: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListCard — a clickable card representing a single list in the grid.
 *
 * - Card body opens `list/<id>` modal.
 * - ⋯ button (top-right) opens `edit-list/<id>` modal — with stopPropagation
 *   so it doesn't also open the list.
 * - Uses Card (interactive) for hover shadow + focus ring.
 */
export function ListCard({ list, typeLabel, onOpen, onEdit }: ListCardProps) {
  const { t } = useTranslation();

  const handleOpen = useCallback(() => onOpen(list.id), [list.id, onOpen]);
  const handleEdit = useCallback(() => onEdit(list.id), [list.id, onEdit]);

  return (
    <Card interactive className="relative flex flex-col gap-3 p-4">
      {/* Top row: icon + title + menu button.
          The title is a stretched-link button: its ::after overlay covers the
          whole card so a click anywhere opens the list, while the ⋯ button sits
          above it (relative z-10). No nested role=button container (U-123). */}
      <div className="flex items-center gap-3">
        <IconPreview iconKey={list.icon} />
        <button
          type="button"
          onClick={handleOpen}
          className="flex-1 min-w-0 text-left font-medium text-text truncate rounded after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1"
        >
          {list.title}
        </button>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleEdit}
          aria-label={t("lists.card.menu")}
          className="relative z-10"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="3" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="8" cy="13" r="1.25" fill="currentColor" stroke="none" />
          </svg>
        </Button>
      </div>

      {/* Bottom row: type badge + ref_no */}
      <div className="flex items-center gap-2 mt-auto">
        <Badge variant={TYPE_VARIANT[list.list_type] ?? "neutral"}>
          {typeLabel}
        </Badge>
        <span className="text-xs text-text-muted">#{list.ref_no}</span>
      </div>
    </Card>
  );
}
