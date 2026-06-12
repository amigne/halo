import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AutosaveField } from "@/shared/autosave/AutosaveField";
import { useAutosaveField } from "@/shared/autosave/use-autosave-field";
import { SaveIndicator } from "@/shared/autosave/SaveIndicator";
import { DateTimePicker } from "@/shared/ui/DateTimePicker";
import { Select } from "@/shared/ui/Select";
import { TagEditor } from "@/shared/ui/TagEditor";
import { useToast } from "@/shared/ui/Toast";
import { updateItem, deleteItem, type ListItemResponse, type ListItemUpdate } from "../api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FieldSchemaEntry {
  key: string;
  type: string;
  required?: boolean;
}

interface ListItemFormProps {
  item: ListItemResponse;
  listId: string;
  fieldSchema: FieldSchemaEntry[];
  timezone: string;
  onDeleted: () => void;
}

// ── Save status for non-string fields (immediate save) ─────────────────────────

type FieldSaveStatus = "idle" | "saving" | "saved" | "error";

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListItemForm — a single item row with inline editing via autosave.
 *
 * Fields are shown according to the list's `field_schema`.  String fields
 * (title, description) use `<AutosaveField>` (debounced PATCH on blur).
 * Other fields (checkbox, select, date, number) save immediately on change.
 */
export function ListItemForm({
  item,
  listId,
  fieldSchema,
  timezone,
  onDeleted,
}: ListItemFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Per-field save status for non-autosave fields
  const [fieldStatus, setFieldStatus] = useState<
    Record<string, FieldSaveStatus>
  >({});

  const schemaMap = new Map(fieldSchema.map((f) => [f.key, f]));
  const hasField = (key: string) => schemaMap.has(key);

  // ── PATCH helper ─────────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["lists", listId, "items"],
    });
  }, [queryClient, listId]);

  const patchItem = useCallback(
    async (partial: ListItemUpdate) => {
      await updateItem(listId, item.id, partial);
      invalidate();
    },
    [listId, item.id, invalidate],
  );

  // ── Immediate save for non-string fields ─────────────────────────────────

  const saveField = useCallback(
    async (fieldKey: string, value: unknown) => {
      setFieldStatus((prev) => ({ ...prev, [fieldKey]: "saving" }));
      try {
        await patchItem({ [fieldKey]: value } as ListItemUpdate);
        setFieldStatus((prev) => ({ ...prev, [fieldKey]: "saved" }));
      } catch (err) {
        setFieldStatus((prev) => ({ ...prev, [fieldKey]: "error" }));
        addToast(
          "error",
          err instanceof Error ? err.message : t("lists.error.update"),
        );
      }
    },
    [patchItem, addToast, t],
  );

  // ── Autosave patch for string fields ─────────────────────────────────────

  const patchTitle = useCallback(
    async (partial: Record<string, string>) => {
      await updateItem(listId, item.id, partial as unknown as ListItemUpdate);
      invalidate();
    },
    [listId, item.id, invalidate],
  );

  const patchDescription = useCallback(
    async (partial: Record<string, string>) => {
      await updateItem(listId, item.id, partial as unknown as ListItemUpdate);
      invalidate();
    },
    [listId, item.id, invalidate],
  );

  // ── Delete handler ───────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    try {
      await deleteItem(listId, item.id);
      onDeleted();
    } catch (err) {
      addToast(
        "error",
        err instanceof Error ? err.message : t("lists.error.delete"),
      );
    }
  }, [listId, item.id, onDeleted, addToast, t]);

  // ── Notify-before autosave (number field, debounced) ─────────────────────

  const notifyAutosave = useAutosaveField({
    value: item.notify_before != null ? String(item.notify_before) : "",
    fieldKey: "notify_before",
    onPatch: async (partial) => {
      const num = partial.notify_before ? Number(partial.notify_before) : null;
      await patchItem({ notify_before: num });
    },
  });

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-wrap items-start gap-3 p-3 rounded-md border border-border bg-surface hover:bg-border/50 transition-colors group">
      {/* is_done checkbox */}
      {hasField("is_done") && (
        <label className="flex items-center pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={(e) => saveField("is_done", e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
            aria-label={t("lists.item.done")}
          />
        </label>
      )}

      {/* Main fields */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title — always present, uses AutosaveField */}
        <AutosaveField
          value={item.title}
          fieldKey="title"
          onPatch={patchTitle}
          label={t("lists.item.title")}
          className="!flex-row !items-center gap-2"
        />

        {/* Description */}
        {hasField("description") && (
          <AutosaveField
            value={item.description ?? ""}
            fieldKey="description"
            onPatch={patchDescription}
            label={t("lists.item.description")}
            renderInput={(api) => (
              <div
                onBlur={api.onBlur}
                onKeyDown={api.handleKeyDown}
                className="w-full"
              >
                <TagEditor
                  value={api.localValue}
                  onChange={api.onChange}
                  variant="multiline"
                  placeholder={t("lists.item.descriptionPlaceholder")}
                  label={t("lists.item.description")}
                />
              </div>
            )}
          />
        )}
      </div>

      {/* Secondary fields */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Priority */}
        {hasField("priority") && (
          <div className="flex items-center gap-1">
            <Select
              value={item.priority != null ? String(item.priority) : ""}
              onChange={(val) =>
                saveField("priority", val ? Number(val) : null)
              }
              placeholder={t("lists.item.priority")}
              options={[
                { value: "0", label: t("lists.item.priorityLow") },
                { value: "1", label: t("lists.item.priorityMedium") },
                { value: "2", label: t("lists.item.priorityHigh") },
                { value: "3", label: t("lists.item.priorityUrgent") },
              ]}
              label={t("lists.item.priority")}
            />
            <SaveIndicator
              status={fieldStatus["priority"] ?? "idle"}
            />
          </div>
        )}

        {/* Due date */}
        {hasField("due_at") && (
          <div className="flex items-center gap-1">
            <DateTimePicker
              label={t("lists.item.dueAt")}
              value={item.due_at ?? ""}
              onChange={(utcIso) => saveField("due_at", utcIso || null)}
              timezone={timezone}
            />
            <SaveIndicator
              status={fieldStatus["due_at"] ?? "idle"}
            />
          </div>
        )}

        {/* Notify before */}
        {hasField("notify_before") && (
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium text-text">
              {t("lists.item.notifyBefore")}
            </label>
            <input
              type="number"
              min="0"
              value={notifyAutosave.localValue}
              onChange={(e) => notifyAutosave.onChange(e.target.value)}
              onBlur={notifyAutosave.onBlur}
              onKeyDown={(e) => notifyAutosave.handleKeyDown(e)}
              className="w-16 min-h-[36px] px-2 py-1 rounded border bg-surface text-text text-sm placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none border-border"
              placeholder="0"
            />
            <SaveIndicator
              status={notifyAutosave.status}
              error={notifyAutosave.error}
              onRetry={notifyAutosave.retry}
            />
          </div>
        )}

        {/* Assignee stub */}
        {hasField("assignee") && (
          <span className="text-xs text-text-muted italic">
            {t("lists.item.assignee")}
          </span>
        )}
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={handleDelete}
        className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none cursor-pointer"
        aria-label={t("lists.item.delete")}
      >
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
        >
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>
    </div>
  );
}
