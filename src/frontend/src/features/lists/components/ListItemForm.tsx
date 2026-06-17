import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAutosaveField } from "@/shared/autosave/use-autosave-field";
import { SaveIndicator } from "@/shared/autosave/SaveIndicator";
import { DateTimePicker } from "@/shared/ui/DateTimePicker";
import { Select } from "@/shared/ui/Select";
import { TagEditor } from "@/shared/ui/TagEditor";
import { Badge, type BadgeVariant } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { useToast } from "@/shared/ui/Toast";
import { getIconPath } from "@/shared/ui/icon-data";
import { formatDateTime } from "@/shared/datetime/format";
import {
  updateItem,
  deleteItem,
  type ListItemResponse,
  type ListItemUpdate,
} from "../api";

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

type FieldSaveStatus = "idle" | "saving" | "saved" | "error";

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
  0: "neutral",  // Low
  1: "primary",  // Medium
  2: "warning",  // High
  3: "danger",   // Urgent
};

function getPriorityBadge(priority: number | null | undefined): BadgeVariant | null {
  if (priority == null) return null;
  return PRIORITY_VARIANT[priority] ?? null;
}

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

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListItemForm — read-first item row with on-demand inline editing.
 *
 * **Read mode** (default): compact row with is_done checkbox, title text
 * (strikethrough + muted if done), priority chip, due date chip, and
 * hover actions (edit + delete).
 *
 * **Edit mode** (click row or pencil): expanded editable fields according
 * to the list's field_schema.  Autosave on blur (U-061), Escape cancels
 * the current field (U-062).  Click "Done" or re-click the row to collapse.
 *
 * useAutosaveField hooks are called unconditionally so they survive
 * read↔edit transitions — no flush-on-unmount needed.
 */
export function ListItemForm({
  item,
  listId,
  fieldSchema,
  timezone,
  onDeleted,
}: ListItemFormProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const lang = i18n.language;

  const [editing, setEditing] = useState(false);
  const [fieldStatus, setFieldStatus] = useState<
    Record<string, FieldSaveStatus>
  >({});

  const schemaMap = new Map(fieldSchema.map((f) => [f.key, f]));
  const hasField = (key: string) => schemaMap.has(key);

  // ── Query invalidation ────────────────────────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["lists", listId, "items"],
    });
  }, [queryClient, listId]);

  // ── PATCH helper ──────────────────────────────────────────────────────────

  const patchItem = useCallback(
    async (partial: ListItemUpdate) => {
      await updateItem(listId, item.id, partial);
      invalidate();
    },
    [listId, item.id, invalidate],
  );

  // ── Immediate save (non-string fields) ────────────────────────────────────

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

  // ── Autosave hooks (always active, even in read mode) ─────────────────────

  const titleAutosave = useAutosaveField({
    value: item.title,
    fieldKey: "title",
    onPatch: async (partial) => {
      await updateItem(listId, item.id, { title: partial.title });
      invalidate();
    },
  });

  const descAutosave = useAutosaveField({
    value: item.description ?? "",
    fieldKey: "description",
    onPatch: async (partial) => {
      await updateItem(listId, item.id, {
        description: partial.description,
      });
      invalidate();
    },
  });

  const notifyAutosave = useAutosaveField({
    value: item.notify_before != null ? String(item.notify_before) : "",
    fieldKey: "notify_before",
    onPatch: async (partial) => {
      const num = partial.notify_before ? Number(partial.notify_before) : null;
      await patchItem({ notify_before: num });
    },
  });

  // ── Delete handler ────────────────────────────────────────────────────────

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

  // ── Edit mode toggle ──────────────────────────────────────────────────────

  const enterEdit = useCallback(() => setEditing(true), []);
  const exitEdit = useCallback(() => setEditing(false), []);

  // ── Render: Read mode ─────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div
        className="flex items-center gap-3 py-2 cursor-pointer group"
        onClick={enterEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            enterEdit();
          }
        }}
        aria-label={`${t("lists.item.edit")} : ${item.title}`}
      >
        {/* is_done checkbox — always visible, toggle does NOT enter edit mode */}
        {hasField("is_done") && (
          <label
            className="flex items-center shrink-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={item.is_done}
              onChange={(e) => saveField("is_done", e.target.checked)}
              className="h-5 w-5 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
              aria-label={t("lists.item.done")}
            />
          </label>
        )}

        {/* Title as text — strikethrough + muted when done */}
        <span
          className={`flex-1 min-w-0 truncate text-sm ${
            item.is_done
              ? "line-through text-text-muted"
              : "text-text"
          }`}
        >
          {item.title || " "}
        </span>

        {/* Priority badge — only if value exists AND field is in schema */}
        {item.priority != null && hasField("priority") && (
          <Badge variant={getPriorityBadge(item.priority) ?? "neutral"}>
            {getPriorityLabel(item.priority, t)}
          </Badge>
        )}

        {/* Due date chip — only if value exists AND field is in schema */}
        {item.due_at && hasField("due_at") && (
          <span
            className={`inline-flex items-center gap-1 text-xs shrink-0 ${
              isOverdue(item.due_at)
                ? "text-danger font-medium"
                : "text-text-muted"
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

        {/* Hover actions — edit pencil + delete trash */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              enterEdit();
            }}
            aria-label={t("lists.item.edit")}
          >
            <SvgIcon d={getIconPath("pencil")!} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            aria-label={t("lists.item.delete")}
          >
            <SvgIcon d={getIconPath("trash")!} />
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: Edit mode ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-wrap items-start gap-3 py-2">
      {/* is_done checkbox */}
      {hasField("is_done") && (
        <label className="flex items-center pt-1 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={item.is_done}
            onChange={(e) => saveField("is_done", e.target.checked)}
            className="h-5 w-5 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
            aria-label={t("lists.item.done")}
          />
        </label>
      )}

      {/* Main fields: title + description */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Title — raw input + SaveIndicator, no AutosaveField wrapper */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={titleAutosave.localValue}
            onChange={(e) => titleAutosave.onChange(e.target.value)}
            onBlur={titleAutosave.onBlur}
            onKeyDown={(e) => titleAutosave.handleKeyDown(e)}
            className="min-h-[36px] w-full px-2 py-1 rounded border bg-surface text-text text-sm placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none border-border"
            placeholder={t("lists.item.titlePlaceholder")}
            aria-label={t("lists.item.title")}
          />
          <SaveIndicator
            status={titleAutosave.status}
            error={titleAutosave.error}
            onRetry={titleAutosave.retry}
          />
        </div>

        {/* Description — only if in field_schema */}
        {hasField("description") && (
          <div
            onBlur={descAutosave.onBlur}
            onKeyDown={descAutosave.handleKeyDown}
            className="w-full"
          >
            <TagEditor
              value={descAutosave.localValue}
              onChange={descAutosave.onChange}
              variant="multiline"
              placeholder={t("lists.item.descriptionPlaceholder")}
              label={t("lists.item.description")}
            />
            <SaveIndicator
              status={descAutosave.status}
              error={descAutosave.error}
              onRetry={descAutosave.retry}
            />
          </div>
        )}
      </div>

      {/* Secondary fields */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Priority — Select, immediate save */}
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

        {/* Due date — DateTimePicker, immediate save */}
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

        {/* Notify before — number input with autosave */}
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

      {/* Done editing button — collapse back to read mode */}
      <Button
        size="icon"
        variant="ghost"
        onClick={exitEdit}
        aria-label={t("lists.item.doneEditing")}
      >
        <SvgIcon d={getIconPath("check")!} />
      </Button>
    </div>
  );
}
