/**
 * TagEditor — TipTap-based tag editor with ``{`` autocomplete, chip
 * rendering, title resolution, cross-module click, and broken-tag
 * handling (étape 5-4 → 5-6, specs/02 §8).
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

import { TagChip, type TagChipAttrs } from "./chip-node";
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

// ── Regex for raw-text ↔ document conversion ─────────────────────────────────

const TAG_RE = /\{([A-Z]+):([1-9][0-9]*)\}/g;

// ── Serialisation: document → raw text ───────────────────────────────────────

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

// ── Deserialisation: raw text → ProseMirror JSON ─────────────────────────────

/**
 * Parse raw text and produce a ProseMirror document JSON structure
 * where ``{PREFIX:ref_no}`` patterns become ``tagChip`` nodes.
 *
 * Every paragraph MUST have at least one child node — ProseMirror
 * rejects ``content: []`` (invalid document).
 */
function rawTextToDoc(raw: string): Record<string, unknown> {
  TAG_RE.lastIndex = 0;

  const lineToNodes = (line: string): unknown[] => {
    const nodes: unknown[] = [];
    let last = 0;
    for (const m of line.matchAll(TAG_RE)) {
      if (m.index! > last) {
        nodes.push({ type: "text", text: line.slice(last, m.index) });
      }
      nodes.push({
        type: "tagChip",
        attrs: {
          tag_prefix: m[1],
          ref_no: Number(m[2]),
          title: null,
          uuid: null,
          broken: false,
        },
      });
      last = m.index! + m[0].length;
    }
    if (last < line.length) {
      nodes.push({ type: "text", text: line.slice(last) });
    }
    // ProseMirror forbids a paragraph with no children.  When a line
    // produces zero nodes (empty line with no tags), insert a single
    // empty text node — the editor normalises this on first interaction.
    if (nodes.length === 0) {
      nodes.push({ type: "text", text: "" });
    }
    return nodes;
  };

  const paragraphs = raw.split("\n").map((line) => ({
    type: "paragraph",
    content: lineToNodes(line),
  }));
  return { type: "doc", content: paragraphs };
}

// ── Helpers (continued) ─────────────────────────────────────────────────────

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
  const isResolving = useRef(false);

  // ── Tag resolution ───────────────────────────────────────────────────────
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
        const newTitle = hit.exists ? hit.title : null;
        const newUuid = hit.uuid;
        const newBroken = !hit.exists;
        if (
          a.title !== newTitle ||
          a.uuid !== newUuid ||
          a.broken !== newBroken
        ) {
          tr.setNodeMarkup(pos, node.type, {
            ...a,
            title: newTitle,
            uuid: newUuid,
            broken: newBroken,
          });
          changed = true;
        }
      }
      return true;
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
    // rawTextToDoc can produce empty paragraphs (content: []) when
    // value is "" — ProseMirror rejects that.  Pass an empty string
    // directly for the null case; TipTap handles it gracefully.
    content: value ? rawTextToDoc(value) : "",
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
      if (isResolving.current) return;

      const raw = docToRawText(ed.state.doc);
      onChangeRef.current(raw);
      const refs = extractTagRefs(ed.state.doc);
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
      const broken = target.dataset.broken === "true";
      if (!uuid || !prefix || broken) return;

      const mod = getTagModule(prefix);
      if (!mod) return;

      e.preventDefault();
      e.stopPropagation();
      openModal(`${mod.detailModalPrefix}${uuid}`);
    },
    [openModal],
  );

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener("click", handleChipClick, true);
    return () => el.removeEventListener("click", handleChipClick, true);
  }, [handleChipClick, editor]);

  // ── Sync external value → editor content ───────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const currentRaw = docToRawText(editor.state.doc);
    if (value !== currentRaw) {
      editor.commands.setContent(
        value ? rawTextToDoc(value) : "",
        { emitUpdate: false },
      );
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
