import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { AutosaveField } from "@/shared/autosave/AutosaveField";
import { Button } from "@/shared/ui/Button";
import { IconPicker } from "@/shared/ui/IconPicker";
import { Spinner } from "@/shared/ui/Spinner";
import { useToast } from "@/shared/ui/Toast";
import { fetchList, updateList, deleteList } from "../api";

// ── Props ──────────────────────────────────────────────────────────────────────

interface EditListModalProps {
  /** Provided by ModalHost — unused in body (close is via ✕/Escape). */
  onClose: () => void;
  /** The full key when prefix-matched, e.g. "edit-list/019ea184-...". */
  modalKey?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * EditListModal — edit list title, icon, or delete the list.
 *
 * Opened from the ListCard menu (⋯). Registered as "edit-list/" prefix.
 * Title autosaves on blur; icon saves immediately on selection.
 * Footer: delete list with confirmation — closes all modals for this list.
 */
export function EditListModal({ onClose: _onClose, modalKey }: EditListModalProps) {
  void _onClose; // used by ModalHost shell (✕ button / Escape)
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const router = useRouter();

  const rawId = modalKey?.replace(/^edit-list\//, "") ?? "";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const listId = UUID_RE.test(rawId) ? rawId : "";

  const { data: list, isLoading } = useQuery({
    queryKey: ["list", listId],
    queryFn: () => fetchList(listId),
    enabled: !!listId,
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Patch helper ────────────────────────────────────────────────────────────

  const patchList = useCallback(
    async (partial: Record<string, string>) => {
      await updateList(listId, { title: partial.title } as Record<string, string>);
      queryClient.invalidateQueries({ queryKey: ["list", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
    },
    [listId, queryClient],
  );

  // ── Icon change ─────────────────────────────────────────────────────────────

  const handleIconChange = useCallback(
    async (iconKey: string) => {
      try {
        await updateList(listId, { icon: iconKey || null });
        queryClient.invalidateQueries({ queryKey: ["list", listId] });
        queryClient.invalidateQueries({ queryKey: ["lists"] });
      } catch (err) {
        addToast("error", err instanceof Error ? err.message : t("lists.error.update"));
      }
    },
    [listId, queryClient, addToast, t],
  );

  // ── Delete list ─────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteList(listId);
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      // Deleting a referenceable object must let cross-module tag chips that
      // point to it re-resolve as broken (F-071/U-085). Without this, the
      // cached resolve result (staleTime) keeps chips showing as resolved.
      queryClient.invalidateQueries({ queryKey: ["refs", "resolve"] });
      addToast("success", t("lists.editModal.deleted"));
      // Close all modals for this list — navigate back to base URL
      const currentSearch = (router.latestLocation.search ?? {}) as Record<string, unknown>;
      const newSearch: Record<string, unknown> = { ...currentSearch };
      delete newSearch.modal;
      router.navigate({ search: newSearch, replace: false } as never);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : t("lists.error.delete"));
    } finally {
      setDeleting(false);
    }
  }, [listId, queryClient, addToast, t, router]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!listId) {
    return <div className="py-8 text-center text-text-muted">{t("lists.error.invalidId")}</div>;
  }
  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner /></div>;
  }
  if (!list) {
    return <div className="py-8 text-center text-text-muted">{t("lists.error.notFound")}</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title — autosave */}
      <AutosaveField
        value={list.title}
        fieldKey="title"
        onPatch={patchList}
        label={t("lists.createModal.titleLabel")}
      />

      {/* Icon */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">
          {t("lists.createModal.iconLabel")}
        </span>
        <IconPicker value={list.icon ?? ""} onChange={handleIconChange} />
      </div>

      {/* Footer: delete */}
      <hr className="border-border" />
      {!confirmDelete ? (
        <div className="flex justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            {t("lists.editModal.delete")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-danger">
            {t("lists.detailModal.deleteConfirm")}
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Spinner size="sm" /> : t("lists.detailModal.deleteConfirmYes")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDelete(false)}
          >
            {t("lists.detailModal.deleteConfirmNo")}
          </Button>
        </div>
      )}
    </div>
  );
}
