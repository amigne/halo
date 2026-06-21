import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoutedModal } from "@/shared/modal";
import { AutosaveField } from "@/shared/autosave/AutosaveField";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import { Toggle } from "@/shared/ui/Toggle";
import { DateTimePicker } from "@/shared/ui/DateTimePicker";
import { TagEditor } from "@/shared/tageditor";
import { Spinner } from "@/shared/ui/Spinner";
import { useToast } from "@/shared/ui/Toast";
import { useAuth } from "@/features/auth/auth-store";
import {
  fetchList,
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
} from "../api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FieldSchemaEntry {
  key: string;
  type: string;
  required?: boolean;
}

interface ListItemModalProps {
  onClose: () => void;
  modalKey?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Dedicated item modal — edit (autosave) or create (atomic).
 *
 * - Edit mode (`list-item/<itemUuid>`): autosave on blur (U-061),
 *   Escape restores field then closes modal (U-062/U-063).
 * - Create mode (`list-item/new`): atomic — no persistence until
 *   "Créer" is clicked (U-052/U-060).
 *
 * The shell `<Modal>` is provided by ModalHost.
 */
export function ListItemModal({ onClose, modalKey }: ListItemModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { modalStack } = useRoutedModal();
  const { addToast } = useToast();
  const { data: auth } = useAuth();
  const timezone = auth?.user?.timezone ?? "UTC";

  // ── Determine listId from the parent modal in the stack ────────────────────

  const parentModalKey = modalStack
    .slice(0, -1) // exclude current modal
    .findLast((k) => k.startsWith("list/"));
  const listId = parentModalKey?.replace(/^list\//, "") ?? "";

  // ── Derive mode from modalKey ──────────────────────────────────────────────

  const isCreate = modalKey === "list-item/new";
  const itemId = !isCreate ? modalKey?.replace(/^list-item\//, "") ?? "" : "";

  // ── Data ───────────────────────────────────────────────────────────────────

  const { data: list, isLoading: listLoading, isError: listError } = useQuery({
    queryKey: ["list", listId],
    queryFn: () => fetchList(listId),
    enabled: !!listId,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["list-items", listId],
    queryFn: () => fetchItems(listId),
    enabled: !!listId,
  });

  const item = !isCreate
    ? items?.find((i) => i.id === itemId) ?? null
    : null;

  // Don't gate on `!list` once the query has settled in error, otherwise a
  // failed fetch would spin forever (handled by the `listError` guard below).
  const isLoading =
    listLoading || itemsLoading || (!!listId && !list && !listError);

  // ── Field schema ───────────────────────────────────────────────────────────

  const rawSchema = list?.field_schema as {
    fields?: FieldSchemaEntry[];
  } | null;
  const fieldSchema: FieldSchemaEntry[] = rawSchema?.fields ?? [];
  const schemaMap = useMemo(
    () => new Map(fieldSchema.map((f) => [f.key, f])),
    [fieldSchema],
  );
  const hasField = useCallback(
    (key: string) => schemaMap.has(key),
    [schemaMap],
  );

  // ── Create mode state ──────────────────────────────────────────────────────

  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createPriority, setCreatePriority] = useState<string>("");
  const [createDueAt, setCreateDueAt] = useState("");
  const [createNotifyBefore, setCreateNotifyBefore] = useState("");
  const [createIsDone, setCreateIsDone] = useState(false);
  const [creating, setCreating] = useState(false);

  // ── Delete ─────────────────────────────────────────────────────────────────

  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteItem(listId, item.id);
      queryClient.invalidateQueries({ queryKey: ["list-items", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      addToast("success", t("lists.item.deleted"));
      onClose();
    } catch (err) {
      addToast(
        "error",
        err instanceof Error ? err.message : t("lists.error.delete"),
      );
    } finally {
      setDeleting(false);
    }
  }, [listId, item, queryClient, addToast, t, onClose]);

  // ── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      await createItem(listId, {
        title: createTitle.trim(),
        description: createDesc || undefined,
        priority: createPriority ? Number(createPriority) : undefined,
        due_at: createDueAt || undefined,
        notify_before: createNotifyBefore ? Number(createNotifyBefore) : undefined,
        is_done: hasField("is_done") ? createIsDone : false,
        position: items?.length ?? 0,
      });
      queryClient.invalidateQueries({ queryKey: ["list-items", listId] });
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      onClose();
    } catch (err) {
      addToast(
        "error",
        err instanceof Error ? err.message : t("lists.error.create"),
      );
    } finally {
      setCreating(false);
    }
  }, [
    listId, createTitle, createDesc, createPriority, createDueAt,
    createNotifyBefore, createIsDone, hasField, queryClient, addToast, t, onClose,
  ]);

  // ── Autosave helpers (edit mode) ───────────────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["list-items", listId] });
  }, [queryClient, listId]);

  const patchItem = useCallback(
    async (partial: Record<string, unknown>) => {
      await updateItem(listId, itemId, partial as Record<string, string | number | boolean | null>);
      invalidate();
    },
    [listId, itemId, invalidate],
  );

  // ── Escape → close (when all fields are clean) ─────────────────────────────

  const handleModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        // AutosaveField handles Escape for dirty fields first.
        // If we receive it here, all fields are clean — close.
        onClose();
      }
    },
    [onClose],
  );

  // ── Render: loading / error ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (listError) {
    return (
      <div className="py-8 text-center text-text-muted">
        {t("lists.error.notFound")}
      </div>
    );
  }

  if (!list) {
    return (
      <div className="py-8 text-center text-text-muted">
        {t("lists.error.invalidId")}
      </div>
    );
  }

  // ── Render: create mode ────────────────────────────────────────────────────

  if (isCreate) {
    return (
      <div className="flex flex-col gap-4" onKeyDown={handleModalKeyDown}>
        {/* Title */}
        <TagEditor
          label={t("lists.item.title")}
          value={createTitle}
          onChange={setCreateTitle}
          variant="single"
          placeholder={t("lists.item.titlePlaceholder")}
        />

        {/* Description */}
        {hasField("description") && (
          <TagEditor
            label={t("lists.item.description")}
            value={createDesc}
            onChange={setCreateDesc}
            variant="multiline"
            placeholder={t("lists.item.descriptionPlaceholder")}
          />
        )}

        {/* Priority */}
        {hasField("priority") && (
          <Select
            label={t("lists.item.priority")}
            value={createPriority}
            onChange={setCreatePriority}
            placeholder={t("lists.item.priority")}
            options={[
              { value: "0", label: t("lists.item.priorityLow") },
              { value: "1", label: t("lists.item.priorityMedium") },
              { value: "2", label: t("lists.item.priorityHigh") },
              { value: "3", label: t("lists.item.priorityUrgent") },
            ]}
          />
        )}

        {/* Due date */}
        {hasField("due_at") && (
          <DateTimePicker
            label={t("lists.item.dueAt")}
            value={createDueAt}
            onChange={setCreateDueAt}
            timezone={timezone}
          />
        )}

        {/* Notify before */}
        {hasField("notify_before") && (
          <Input
            label={t("lists.item.notifyBefore")}
            type="number"
            min="0"
            value={createNotifyBefore}
            onChange={(e) => setCreateNotifyBefore(e.target.value)}
            placeholder="0"
          />
        )}

        {/* is_done */}
        {hasField("is_done") && (
          <Toggle
            label={t("lists.item.done")}
            checked={createIsDone}
            onChange={setCreateIsDone}
          />
        )}

        {/* Footer: create button */}
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!createTitle.trim() || creating}
          >
            {creating ? <Spinner size="sm" /> : t("lists.item.create")}
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: edit mode ──────────────────────────────────────────────────────

  if (!item) {
    return (
      <div className="py-8 text-center text-text-muted">
        {t("lists.error.notFound")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" onKeyDown={handleModalKeyDown}>
      {/* Title — autosave via TagEditor (single-line). */}
      <AutosaveField
        value={item.title}
        fieldKey="title"
        onPatch={patchItem}
        label={t("lists.item.title")}
        renderInput={({ localValue, onChange, onBlur, handleKeyDown }) => (
          <div onBlur={onBlur} onKeyDown={handleKeyDown}>
            <TagEditor
              value={localValue}
              onChange={onChange}
              variant="single"
              placeholder={t("lists.item.titlePlaceholder")}
              label={t("lists.item.title")}
            />
          </div>
        )}
      />

      {/* Description — autosave via TagEditor.
          The wrapper's onBlur/onKeyDown catch the textarea's bubbling
          focusout/keydown (React onBlur === focusout, which bubbles), so the
          debounced save fires when focus leaves the field and Escape restores
          the value. The AutosaveField label row already renders a SaveIndicator. */}
      {hasField("description") && (
        <AutosaveField
          value={item.description ?? ""}
          fieldKey="description"
          onPatch={patchItem}
          label={t("lists.item.description")}
          renderInput={({ localValue, onChange, onBlur, handleKeyDown }) => (
            <div onBlur={onBlur} onKeyDown={handleKeyDown}>
              <TagEditor
                value={localValue}
                onChange={onChange}
                variant="multiline"
                placeholder={t("lists.item.descriptionPlaceholder")}
                label={t("lists.item.description")}
              />
            </div>
          )}
        />
      )}

      {/* Priority — immediate save on change */}
      {hasField("priority") && (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select
              label={t("lists.item.priority")}
              value={item.priority != null ? String(item.priority) : ""}
              onChange={(val) =>
                patchItem({ priority: val ? Number(val) : null })
              }
              placeholder={t("lists.item.priority")}
              options={[
                { value: "0", label: t("lists.item.priorityLow") },
                { value: "1", label: t("lists.item.priorityMedium") },
                { value: "2", label: t("lists.item.priorityHigh") },
                { value: "3", label: t("lists.item.priorityUrgent") },
              ]}
            />
          </div>
        </div>
      )}

      {/* Due date — immediate save */}
      {hasField("due_at") && (
        <DateTimePicker
          label={t("lists.item.dueAt")}
          value={item.due_at ?? ""}
          onChange={(utcIso) => patchItem({ due_at: utcIso || null })}
          timezone={timezone}
        />
      )}

      {/* Notify before — autosave */}
      {hasField("notify_before") && (
        <AutosaveField
          value={item.notify_before != null ? String(item.notify_before) : ""}
          fieldKey="notify_before"
          onPatch={async (partial) => {
            const num = partial.notify_before ? Number(partial.notify_before) : null;
            await patchItem({ notify_before: num });
          }}
          label={t("lists.item.notifyBefore")}
          renderInput={({ localValue, onChange, onBlur, handleKeyDown, inputId }) => (
            <input
              id={inputId}
              type="number"
              min="0"
              value={localValue}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              onKeyDown={handleKeyDown}
              className="w-24 px-2 py-1 rounded border border-border-strong bg-surface text-text text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1"
              placeholder="0"
            />
          )}
        />
      )}

      {/* is_done — immediate save */}
      {hasField("is_done") && (
        <Toggle
          label={t("lists.item.done")}
          checked={item.is_done}
          onChange={(checked) => patchItem({ is_done: checked })}
        />
      )}

      {/* Assignee stub */}
      {hasField("assignee") && (
        <span className="text-xs text-text-muted italic">
          {t("lists.item.assignee")}
        </span>
      )}

      {/* Footer: delete */}
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? <Spinner size="sm" /> : t("lists.item.delete")}
        </Button>
      </div>
    </div>
  );
}
