import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useRoutedModal } from "@/shared/modal";
import { useToast } from "@/shared/ui/Toast";
import { getIconPath } from "@/shared/ui/icon-data";
import { fetchList, fetchItems, updateItem } from "../api";
import { ListItemRow } from "./ListItemRow";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ListDetailModalProps {
  onClose: () => void;
  /** The full key when prefix-matched, e.g. "list/019ea184-...". */
  modalKey?: string;
}

// ── Icon preview ───────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListDetailModal — read-only list view with item rows.
 *
 * - Header: icon + title (read-only), type badge, item count
 * - Body: read-only item rows (ListItemRow), click opens `list-item/<id>` modal
 * - "Add item" button opens `list-item/new` modal
 * - No list-level editing (title/icon/delete) — that lives in EditListModal
 */
export function ListDetailModal({ onClose: _onClose, modalKey }: ListDetailModalProps) {
  void _onClose; // used by ModalHost shell (✕ button / Escape)
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openModal } = useRoutedModal();
  const { addToast } = useToast();

  const rawId = modalKey?.replace(/^list\//, "") ?? "";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const listId = UUID_RE.test(rawId) ? rawId : "";

  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["list", listId],
    queryFn: () => fetchList(listId),
    enabled: !!listId,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["list-items", listId],
    queryFn: () => fetchItems(listId),
    enabled: !!listId,
  });

  const handleToggleDone = useCallback(
    async (itemId: string, checked: boolean) => {
      try {
        await updateItem(listId, itemId, { is_done: checked });
        queryClient.invalidateQueries({ queryKey: ["list-items", listId] });
      } catch (err) {
        addToast("error", err instanceof Error ? err.message : t("lists.error.update"));
      }
    },
    [listId, queryClient, addToast, t],
  );

  // ── Loading / error states ─────────────────────────────────────────────────

  if (!listId) {
    return <div className="py-8 text-center text-text-muted">{t("lists.error.invalidId")}</div>;
  }
  if (listLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  }
  if (!list) {
    return <div className="py-8 text-center text-text-muted">{t("lists.error.notFound")}</div>;
  }

  const rawSchema = list.field_schema as { fields?: Array<{ key: string; type: string; required?: boolean }> } | null;
  const fieldSchema = rawSchema?.fields ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Header: icon + title (read-only) + type badge */}
      <div className="flex items-start gap-4">
        <IconPreview iconKey={list.icon} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-text truncate">{list.title}</h2>
        </div>
        <Badge
          variant={
            list.list_type === "tasks" ? "primary"
            : list.list_type === "checklist" ? "success"
            : list.list_type === "ideas" ? "warning"
            : "neutral"
          }
          className="shrink-0 mt-0.5"
        >
          {t(`lists.type.${list.list_type}`)}
        </Badge>
      </div>

      <hr className="border-border" />

      {/* Items section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">
            {t("lists.detailModal.items", { count: items?.length ?? 0 })}
          </h3>
          <Button size="sm" onClick={() => openModal("list-item/new")}>
            {t("lists.detailModal.addItem")}
          </Button>
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-8"><Spinner /></div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            title={t("lists.detailModal.noItems")}
            description={t("lists.detailModal.noItemsHint")}
            action={
              <Button size="sm" onClick={() => openModal("list-item/new")}>
                {t("lists.detailModal.addItem")}
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
            {items.map((item) => (
              <ListItemRow
                key={item.id}
                item={item}
                fieldSchema={fieldSchema}
                timezone="UTC"
                onToggleDone={handleToggleDone}
                onClick={(itemId) => openModal(`list-item/${itemId}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
