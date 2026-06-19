/**
 * TagEditor — TipTap-based tag editor with ``{`` autocomplete, chip
 * rendering, title resolution, cross-module click, and broken-tag
 * handling (étape 5-4 → 5-5, specs/02 §8).
 *
 * **Public API is unchanged** from the étape 3-10 stub:
 * ``value`` / ``onChange`` / ``multiline``.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useEditor, EditorContent } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { History } from "@tiptap/extension-history";
import type { Node as ProseMirrorNode, Slice } from "@tiptap/pm/model";

import { getTagModule } from "@/modules/registry";
import { useRoutedModal } from "@/shared/modal";

import { BROKEN_SENTINEL, TagChip, type TagChipAttrs } from "./chip-node";
import { TagSuggestion } from "./suggestion";
import { useResolveTags, type TagRef } from "./use-resolve-tags";

// ── Props ────────────────────────────────────────────────────────────────────

export interface TagEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: "single" | "multiline";
  placeholder?: string;
  label?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function docToRawText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n", (leafNode) => {
    if (leafNode.type.name === "tagChip") {
      const a = leafNode.attrs as TagChipAttrs;
      return `{${a.tag_prefix}:${a.ref_no}}`;
    }
    return "";
  });
}

/** Collect every ``(tag_prefix, ref_no)`` from chip nodes in the document. */
function extractTagRefs(doc: ProseMirrorNode): TagRef[] {
  const refs: TagRef[] = [];
  doc.descendants((node) => {
    if (node.type.name === "tagChip") {
      const a = node.attrs as TagChipAttrs;
      refs.push({ tag_prefix: a.tag_prefix, ref_no: a.ref_no });
    }
    return true;
  });
  return refs;
}

// ── Helpers (continued) ─────────────────────────────────────────────────────

/** useState that also exposes a stable ref (avoids stale closures). */
function useStateAsRef<T>(initial: T) {
  const [state, setState] = useState<T>(initial);
  const ref = useRef(state);
  ref.current = state;
  return [state, setState, ref] as const;
}

// ── Component ────────────────────────────────────────────────────────────────

export function TagEditor({
  value,
  onChange,
  disabled = false,
  variant = "single",
  placeholder,
  label,
}: TagEditorProps) {
  const { t } = useTranslation();
  const multiline = variant === "multiline";
  const { openModal } = useRoutedModal();
  const editorId = useId();

  // ── Refs ─────────────────────────────────────────────────────────────────
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  /** Set while ``syncChipTitles`` dispatches a transaction so ``onUpdate``
   * can skip the redundant ref-extraction + onChange call. */
  const isResolving = useRef(false);

  // ── Tag resolution ───────────────────────────────────────────────────────
  // We accumulate refs from the document and batch-resolve them.
  const [tagRefs, setTagRefs] = useStateAsRef<TagRef[]>([]);
  const resolveQuery = useResolveTags(tagRefs);

  const placeholderText = placeholder ?? t("ui.tagEditor.placeholder");
  const brokenLabel = t("ui.tagEditor.brokenTag");

  // ── Extensions ──────────────────────────────────────────────────────────
  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({ placeholder: placeholderText }),
      TagChip.configure({ brokenLabel }),
      TagSuggestion,
    ],
    [placeholderText, brokenLabel],
  );

  // ── Clipboard: serialize chips as raw `{PREFIX:ref_no}` on copy ─────────
  const clipboardTextSerializer = useCallback(
    (slice: Slice) => {
      return docToRawText(slice.content as unknown as ProseMirrorNode);
    },
    [],
  );

  // ── Sync resolved titles back to chip nodes ──────────────────────────────
  const syncChipTitles = useCallback(() => {
    const ed = editorRef.current;
    if (!ed || resolveQuery.data == null) return;

    const resolved = resolveQuery.data;
    const tr = ed.state.tr;
    let changed = false;

    ed.state.doc.descendants((node, pos) => {
      if (node.type.name !== "tagChip") return true;
      const a = node.attrs as TagChipAttrs;
      const key = `${a.tag_prefix}:${a.ref_no}`;
      const hit = resolved.get(key);

      if (hit) {
        const newTitle = hit.exists ? hit.title : BROKEN_SENTINEL;
        const newUuid = hit.uuid;
        if (a.title !== newTitle || a.uuid !== newUuid) {
          tr.setNodeMarkup(pos, node.type, {
            ...a,
            title: newTitle,
            uuid: newUuid,
          });
          changed = true;
        }
      }
      return true; // continue traversal (but chip is atom, so no children)
    });

    if (changed) {
      isResolving.current = true;
      ed.view.dispatch(tr);
      isResolving.current = false;
    }
  }, [resolveQuery.data]);

  useEffect(() => {
    syncChipTitles();
  }, [syncChipTitles]);

  // ── Editor setup ────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    editorProps: {
      clipboardTextSerializer,
      attributes: {
        id: editorId,
        "data-tag-editor": "",
        "aria-label": label ?? t("ui.tagEditor.label"),
        class: [
          "prose prose-sm max-w-none",
          "w-full px-3 py-2 rounded-md border bg-surface text-text",
          "placeholder:text-text-muted",
          "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
          "border-border",
          "[@media(pointer:coarse)]:min-h-11",
          disabled ? "opacity-50 pointer-events-none" : "",
        ].join(" "),
      },
      handleKeyDown: !multiline
        ? (_view, event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              return true;
            }
            return false;
          }
        : undefined,
    },
    onUpdate: useCallback(({ editor: ed }) => {
      // Skip updates triggered by our own chip-title sync (prevents
      // redundant doc traversal + state updates when only attrs changed).
      if (isResolving.current) return;

      const raw = docToRawText(ed.state.doc);
      onChangeRef.current(raw);
      // Collect refs for resolution
      const refs = extractTagRefs(ed.state.doc);
      // Only fire state update when the set actually changes (prevents loops)
      setTagRefs((prev) => {
        const same =
          prev.length === refs.length &&
          prev.every(
            (r, i) =>
              r.tag_prefix === refs[i]!.tag_prefix &&
              r.ref_no === refs[i]!.ref_no,
          );
        return same ? prev : refs;
      });
    }, []),
  });

  // Keep a ref so syncChipTitles can access the editor without a dep on `editor`.
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // ── Chip click → open cross-module modal ──────────────────────────────────
  const handleChipClick = useCallback(
    (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(
        "[data-tag-chip]",
      ) as HTMLElement | null;
      if (!target) return;

      const uuid = target.dataset.uuid;
      const prefix = target.dataset.tagPrefix;
      if (!uuid || !prefix) return; // broken or unresolved — not clickable

      const mod = getTagModule(prefix);
      if (!mod) return;

      e.preventDefault();
      e.stopPropagation();
      openModal(`${mod.detailModalPrefix}${uuid}`);
    },
    [openModal],
  );

  // Attach / detach the delegated click listener on the editor's DOM wrapper.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // The editor content is inside this wrapper; use capture phase so we
    // catch clicks on chips before they bubble to contentEditable handlers.
    el.addEventListener("click", handleChipClick, true);
    return () => el.removeEventListener("click", handleChipClick, true);
  }, [handleChipClick, editor]);

  // ── Sync external value → editor content ───────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const currentRaw = docToRawText(editor.state.doc);
    if (value !== currentRaw) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return (
    <div ref={wrapperRef}>
      <label htmlFor={editorId} className="sr-only">
        {label ?? t("ui.tagEditor.label")}
      </label>
      <EditorContent editor={editor} />
    </div>
  );
}
