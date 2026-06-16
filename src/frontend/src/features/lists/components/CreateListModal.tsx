import { type FormEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button";
import { IconPicker } from "@/shared/ui/IconPicker";
import { Input } from "@/shared/ui/Input";
import { useToast } from "@/shared/ui/Toast";
import { createList, type ListCreate } from "../api";

// ── List types ─────────────────────────────────────────────────────────────────

const LIST_TYPES = [
  { key: "tasks", icon: "check-circle" },
  { key: "checklist", icon: "check" },
  { key: "ideas", icon: "lightbulb" },
  { key: "custom", icon: "grid" },
] as const;

// ── Available fields for the "custom" type ─────────────────────────────────────

const AVAILABLE_FIELDS = [
  { key: "title", labelKey: "lists.createModal.fieldTitle", alwaysOn: true },
  { key: "description", labelKey: "lists.createModal.fieldDescription" },
  { key: "priority", labelKey: "lists.createModal.fieldPriority" },
  { key: "due_at", labelKey: "lists.createModal.fieldDueAt" },
  { key: "notify_before", labelKey: "lists.createModal.fieldNotifyBefore" },
  { key: "assignee", labelKey: "lists.createModal.fieldAssignee" },
  { key: "is_done", labelKey: "lists.createModal.fieldIsDone" },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface CreateListModalProps {
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * CreateListModal — atomic list creation (U-052).
 *
 * Lets the user choose a type (tasks/checklist/ideas/custom),
 * enter a title, pick an icon, and — for the "custom" type —
 * select which fields to include in the field_schema.
 *
 * Registered as `registerModal("create-list", ...)`.
 */
export function CreateListModal({ onClose }: CreateListModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [type, setType] = useState<string>("tasks");
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(["title"]),
  );
  const [submitting, setSubmitting] = useState(false);

  // ── Field toggling (custom type only) ────────────────────────────────────

  const toggleField = useCallback((key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;

      setSubmitting(true);
      try {
        const payload: ListCreate = {
          title: title.trim(),
          list_type: type,
          icon: icon || null,
        };

        // Only include field_schema for custom type; backend applies preset for others
        if (type === "custom") {
          const fields = AVAILABLE_FIELDS.filter(
            (f) => selectedFields.has(f.key),
          ).map((f) => ({
            key: f.key,
            type:
              f.key === "due_at" ? "datetime"
              : f.key === "notify_before" ? "number"
              : f.key === "is_done" ? "checkbox"
              : f.key === "priority" ? "select"
              : "text",
            required: f.key === "title",
          }));
          payload.field_schema = { fields };
        }

        await createList(payload);
        queryClient.invalidateQueries({ queryKey: ["lists"] });
        addToast("success", t("lists.createModal.success"));
        onClose();
      } catch (err) {
        addToast(
          "error",
          err instanceof Error ? err.message : t("lists.error.create"),
        );
      } finally {
        setSubmitting(false);
      }
    },
    [title, type, icon, selectedFields, queryClient, addToast, t, onClose],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Type selector */}
      <fieldset>
        <legend className="text-sm font-medium text-text mb-2">
          {t("lists.createModal.typeLabel")}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {LIST_TYPES.map((lt) => (
            <label
              key={lt.key}
              className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${
                type === lt.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-text hover:bg-border"
              }`}
            >
              <input
                type="radio"
                name="listType"
                value={lt.key}
                checked={type === lt.key}
                onChange={(e) => setType(e.target.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium">
                {t(`lists.type.${lt.key}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Title */}
      <Input
        id="list-title"
        label={t("lists.createModal.titleLabel")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("lists.createModal.titlePlaceholder")}
        required
        minLength={1}
        maxLength={500}
      />

      {/* Icon */}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text">
          {t("lists.createModal.iconLabel")}
        </span>
        <IconPicker value={icon} onChange={setIcon} />
      </div>

      {/* Advanced fields (custom type only) */}
      {type === "custom" && (
        <fieldset>
          <legend className="text-sm font-medium text-text mb-2">
            {t("lists.createModal.advancedTitle")}
          </legend>
          <div className="flex flex-col gap-1">
            {AVAILABLE_FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(f.key)}
                  disabled={f.alwaysOn}
                  onChange={() => toggleField(f.key)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-focus-ring"
                />
                <span
                  className={`text-sm ${
                    f.alwaysOn ? "text-text-muted" : "text-text"
                  }`}
                >
                  {t(f.labelKey)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting || !title.trim()}>
          {submitting ? t("ui.button.loading") : t("lists.createModal.submit")}
        </Button>
      </div>
    </form>
  );
}
