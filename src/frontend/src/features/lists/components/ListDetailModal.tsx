import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AutosaveField } from "@/shared/autosave/AutosaveField";
import { Button } from "@/shared/ui/Button";
import { IconPicker } from "@/shared/ui/IconPicker";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { useAuth } from "@/features/auth/auth-store";
import { useToast } from "@/shared/ui/Toast";
import {
  fetchList,
  fetchItems,
  updateList,
  deleteList,
  createItem,
} from "../api";
import { ListItemForm } from "./ListItemForm";

// ── Props ──────────────────────────────────────────────────────────────────────

interface ListDetailModalProps {
  onClose: () => void;
  /** The full modal key when prefix-matched, e.g. "list/019ea184-...". */
  modalKey?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListDetailModal — detail/editing view for a single list (U-051, U-054).
 *
 * Registered as a prefix-modal (`registerModal("list/", ...)`) so that
 * navigating to `?modal=list/<uuid>` opens this component with `modalKey`
 * set to the full key.
 *
 * Features:
 * - Editable title via AutosaveField
 * - Icon picker (saves immediately)
 * - Delete button with confirmation
 * - List of items using ListItemForm
 * - Add-item button
 */
export function ListDetailModal({ onClose, modalKey }: ListDetailModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { data: auth } = useAuth();
  const timezone = auth?.user?.timezone ?? "UTC";

  // Validate and sanitize the list ID from the URL to prevent path traversal
  const rawId = modalKey?.replace(/^list\//, "") ?? "";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const listId = UUID_RE.test(rawId) ? rawId : "";
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const {
    data: list,
    isLoading: listLoading,
  } = useQuery({
    queryKey: ["lists", listId],
    queryFn: () => fetchList(listId),
    enabled: !!listId,
  });

  const {
    data: items,
    isLoading: itemsLoading,
  } = useQuery({
    queryKey: ["lists", listId, "items"],
    queryFn: () => fetchItems(listId),
    enabled: !!listId,
  });

  // ── List mutations ───────────────────────────────────────────────────────

  const patchList = useCallback(
    async (partial: Record<string, string>) => {
      await updateList(listId, { title: partial.title });
      queryClient.invalidateQueries({ queryKey: ["lists", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    [listId, queryClient],
  );

  const handleIconChange = useCallback(
    async (iconKey: string) => {
      try {
        await updateList(listId, { icon: iconKey || null });
        queryClient.invalidateQueries({ queryKey: ["lists", listId] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      } catch (err) {
        addToast(
          "error",
          err instanceof Error ? err.message : t("lists.error.update"),
        );
      }
    },
    [listId, queryClient, addToast, t],
  );

  const handleDelete = useCallback(async () => {
    try {
      await deleteList(listId);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      addToast("success", t("lists.detailModal.deleted"));
      onClose();
    } catch (err) {
      addToast(
        "error",
        err instanceof Error ? err.message : t("lists.error.delete"),
      );
    }
  }, [listId, queryClient, addToast, t, onClose]);

  // ── Item mutations ───────────────────────────────────────────────────────

  const handleAddItem = useCallback(async () => {
    try {
      await createItem(listId, {
        title: t("lists.item.newItemTitle"),
        is_done: false,
        position: (items?.length ?? 0),
      });
      queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
    } catch (err) {
      addToast(
        "error",
        err instanceof Error ? err.message : t("lists.error.create"),
      );
    }
  }, [listId, items?.length, queryClient, addToast, t]);

  const handleItemDeleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["lists", listId, "items"] });
  }, [listId, queryClient]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (!listId) {
    return (
      <div className="py-8 text-center text-text-muted">
        {t("lists.error.invalidId")}
      </div>
    );
  }

  if (listLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="py-8 text-center text-text-muted">
        {t("lists.error.notFound")}
      </div>
    );
  }

  // field_schema is a dict like {"fields": [...]} — extract the fields array
  const rawSchema = list.field_schema as { fields?: Array<{ key: string; type: string; required?: boolean }> } | null;
  const fieldSchema: Array<{ key: string; type: string; required?: boolean }> =
    rawSchema?.fields ?? [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Header: title + icon + type badge */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <AutosaveField
            value={list.title}
            fieldKey="title"
            onPatch={patchList}
            label={t("lists.createModal.titleLabel")}
          />
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="text-xs font-medium text-text-muted">
            {t("lists.createModal.iconLabel")}
          </span>
          <IconPicker
            value={list.icon ?? ""}
            onChange={handleIconChange}
          />
        </div>

        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium shrink-0 mt-6 ${
            list.list_type === "tasks"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              : list.list_type === "checklist"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : list.list_type === "ideas"
                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
          }`}
        >
          {t(`lists.type.${list.list_type}`)}
        </span>
      </div>

      {/* Divider */}
      <hr className="border-border" />

      {/* Items section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">
            {t("lists.detailModal.items", { count: items?.length ?? 0 })}
          </h3>
          <Button size="sm" onClick={handleAddItem}>
            {t("lists.detailModal.addItem")}
          </Button>
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState
            title={t("lists.detailModal.noItems")}
            description={t("lists.detailModal.noItemsHint")}
            action={
              <Button size="sm" onClick={handleAddItem}>
                {t("lists.detailModal.addItem")}
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
            {items.map((item) => (
              <ListItemForm
                key={item.id}
                item={item}
                listId={listId}
                fieldSchema={fieldSchema}
                timezone={timezone}
                onDeleted={handleItemDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: delete */}
      <hr className="border-border" />
      <div className="flex justify-between items-center">
        {!confirmDelete ? (
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            {t("lists.detailModal.delete")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600 dark:text-red-400">
              {t("lists.detailModal.deleteConfirm")}
            </span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleDelete}
            >
              {t("lists.detailModal.deleteConfirmYes")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              {t("lists.detailModal.deleteConfirmNo")}
            </Button>
          </div>
        )}

        <Button type="button" variant="secondary" onClick={onClose}>
          {t("ui.modal.close")}
        </Button>
      </div>
    </div>
  );
}
