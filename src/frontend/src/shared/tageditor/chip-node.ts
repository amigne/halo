/**
 * TipTap custom inline node that renders a ``{PREFIX:ref_no}`` tag as a
 * styled, non-editable **chip**.
 *
 * Text serialization
 * ------------------
 * The node stores its raw representation as ``renderText`` so that
 * ``Node.textBetween()`` (and therefore ``editor.getText()``) naturally
 * emits ``{PREFIX:ref_no}`` when a ``leafText`` callback is passed.
 * Because ProseMirror's ``getText`` does **not** accept a leaf callback,
 * the ``TagEditor`` component handles serialisation itself by traversing
 * the document tree — see :func:`extractRawText` in ``TagEditor.tsx``.
 */

import { Node } from "@tiptap/core";

export interface TagChipAttrs {
  tag_prefix: string;
  ref_no: number;
  /** Resolved display title (may be known from autocomplete hit). */
  title: string | null;
}

export const TagChip = Node.create({
  name: "tagChip",

  group: "inline",
  inline: true,
  atom: true, // deleted as a unit, not editable character-by-character

  addAttributes() {
    return {
      tag_prefix: { default: "", parseHTML: (el) => el.dataset.tagPrefix },
      ref_no: {
        default: 1,
        parseHTML: (el) => Number(el.dataset.refNo),
      },
      title: {
        default: null,
        parseHTML: (el) => el.dataset.title ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-tag-chip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { tag_prefix, ref_no, title } = node.attrs as TagChipAttrs;
    const label = title
      ? `${tag_prefix}:${ref_no} — ${title}`
      : `${tag_prefix}:${ref_no}`;

    return [
      "span",
      {
        ...HTMLAttributes,
        "data-tag-chip": "",
        "data-tag-prefix": tag_prefix,
        "data-ref-no": String(ref_no),
        "data-title": title ?? "",
        class:
          "tag-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md " +
          "bg-primary/10 text-primary font-medium text-sm " +
          "cursor-default select-none whitespace-nowrap",
        contenteditable: "false",
      },
      label,
    ];
  },

  /**
   * Text representation used by ``Node.textBetween(…, leafText)`` when the
   * caller passes a callback.  ``editor.getText()`` does NOT use this, so
   * the ``TagEditor`` component does its own serialisation.
   */
  renderText({ node }) {
    const { tag_prefix, ref_no } = node.attrs as TagChipAttrs;
    return `{${tag_prefix}:${ref_no}}`;
  },
});
