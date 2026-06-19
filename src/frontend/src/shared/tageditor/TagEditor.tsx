/**
 * TagEditor — TipTap-based tag editor with ``{`` autocomplete and chip
 * rendering (étape 5-4, specs/02 §8, U-080..U-083, U-087).
 *
 * **Public API is unchanged** from the étape 3-10 stub:
 * ``value`` / ``onChange`` / ``multiline``.
 *
 * Storage
 * -------
 * The value emitted by ``onChange`` is **raw text** (e.g.
 * ``{LIST:3} {NOTE:7}``).  TipTap renders recognised tags as styled chips
 * internally, but the caller never sees the chip representation — only
 * the raw text.
 *
 * Variants
 * --------
 * - ``multiline`` / ``variant="multiline"`` → WYSIWYG with line breaks.
 * - ``!multiline`` / ``variant="single"`` → single-line, Enter blocked.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useEditor, EditorContent } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { History } from "@tiptap/extension-history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { TagChip } from "./chip-node";
import { TagSuggestion } from "./suggestion";

// ── Props ────────────────────────────────────────────────────────────────────

export interface TagEditorProps {
  /** Current tag string value (e.g. ``"{LIST:42} {NOTE:7}"``). */
  value: string;
  /** Called when the tag string changes (raw text). */
  onChange: (value: string) => void;
  /** Whether the editor is disabled. */
  disabled?: boolean;
  /**
   * Variant: ``"single"`` (inline, no line breaks) or ``"multiline"``
   * (WYSIWYG with paragraphs).  Default: ``"single"``.
   */
  variant?: "single" | "multiline";
  /** Placeholder text for the empty state. */
  placeholder?: string;
  /** Optional label for ARIA. */
  label?: string;
}

// ── Serialisation helpers ────────────────────────────────────────────────────

/**
 * Walk the ProseMirror document tree and reconstruct the raw text
 * representation, emitting ``{PREFIX:ref_no}`` for each chip node.
 */
function docToRawText(doc: ProseMirrorNode): string {
  return doc.textBetween(0, doc.content.size, "\n", (leafNode) => {
    if (leafNode.type.name === "tagChip") {
      const a = leafNode.attrs as { tag_prefix: string; ref_no: number };
      return `{${a.tag_prefix}:${a.ref_no}}`;
    }
    return "";
  });
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

  // Stable onChange ref to avoid re-creating the editor on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const placeholderText =
    placeholder ?? t("ui.tagEditor.placeholder");

  // ── Extensions ──────────────────────────────────────────────────────────
  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({ placeholder: placeholderText }),
      TagChip,
      TagSuggestion,
    ],
    [placeholderText],
  );

  // ── Editor setup ────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        "data-tag-editor": "",
        "aria-label": label ?? t("ui.tagEditor.label"),
        class: [
          // Base prose styles
          "prose prose-sm max-w-none",
          // Shared look
          "w-full px-3 py-2 rounded-md border bg-surface text-text",
          "placeholder:text-text-muted",
          "focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none",
          "border-border",
          // Touch target
          "[@media(pointer:coarse)]:min-h-11",
          // Disabled
          disabled ? "opacity-50 pointer-events-none" : "",
        ].join(" "),
      },
      // Block Enter in single-line mode
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
    // ── onUpdate: extract raw text → onChange ──────────────────────────
    onUpdate: useCallback(({ editor: ed }) => {
      const raw = docToRawText(ed.state.doc);
      onChangeRef.current(raw);
    }, []),
  });

  // ── Sync external value → editor content ───────────────────────────────
  // Only update when value changes externally (e.g. parent reset).
  // We compare the raw text output to avoid cursor-position resets.
  useEffect(() => {
    if (!editor) return;
    // Avoid loops: only sync when external value differs from current.
    const currentRaw = docToRawText(editor.state.doc);
    if (value !== currentRaw) {
      // Replace content programmatically.
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return <EditorContent editor={editor} />;
}
