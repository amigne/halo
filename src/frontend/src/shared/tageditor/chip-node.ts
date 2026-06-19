/**
 * TipTap custom inline node that renders a ``{PREFIX:ref_no}`` tag as a
 * styled, non-editable **chip** (étape 5-4 → 5-5).
 *
 * States
 * ------
 * - **unresolved** (``title === null``) — plain ``{PREFIX:ref_no}``,
 *   neutral styling, not clickable.
 * - **resolved** (``title`` is a string) — ``{PREFIX:ref_no — Title}``,
 *   clickable → opens cross-module detail modal (U-084).
 * - **broken** (``title === "__broken__"``) — ``{PREFIX:ref_no — (deleted)}``,
 *   muted styling, not clickable (F-071/U-085).
 *
 * Text serialization
 * ------------------
 * ``renderText`` returns ``{PREFIX:ref_no}`` so that document traversal
 * produces the raw storage representation.
 */

import { Node } from "@tiptap/core";

export const BROKEN_SENTINEL = "__broken__";

export interface TagChipAttrs {
  tag_prefix: string;
  ref_no: number;
  title: string | null;
  uuid: string | null;
}

export interface TagChipOptions {
  /** i18n label displayed for broken (deleted) tags, e.g. ``"(supprimé)"``. */
  brokenLabel: string;
}

export const TagChip = Node.create<TagChipOptions>({
  name: "tagChip",

  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return { brokenLabel: "deleted" };
  },

  addAttributes() {
    return {
      tag_prefix: { default: "", parseHTML: (el) => el.dataset.tagPrefix },
      ref_no: {
        default: 1,
        parseHTML: (el) => Number(el.dataset.refNo),
      },
      title: {
        default: null,
        parseHTML: (el) => {
          const t = el.dataset.title;
          return t === "" ? null : t ?? null;
        },
      },
      uuid: {
        default: null,
        parseHTML: (el) => el.dataset.uuid ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-tag-chip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { tag_prefix, ref_no, title, uuid } = node.attrs as TagChipAttrs;
    const isBroken = title === BROKEN_SENTINEL;
    const hasTitle = title !== null && !isBroken;

    let label: string;
    if (isBroken) {
      label = `${tag_prefix}:${ref_no} — (${this.options.brokenLabel})`;
    } else if (hasTitle) {
      label = `${tag_prefix}:${ref_no} — ${title}`;
    } else {
      label = `${tag_prefix}:${ref_no}`;
    }

    // Base + state-dependant classes
    const stateClass = isBroken
      ? "tag-chip--broken line-through opacity-60 cursor-not-allowed"
      : hasTitle
        ? "tag-chip--resolved cursor-pointer hover:brightness-110"
        : "tag-chip--unresolved cursor-default";

    return [
      "span",
      {
        ...HTMLAttributes,
        "data-tag-chip": "",
        "data-tag-prefix": tag_prefix,
        "data-ref-no": String(ref_no),
        "data-title": title ?? "",
        "data-uuid": uuid ?? "",
        class:
          "tag-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md " +
          "bg-primary/10 text-primary font-medium text-sm " +
          "select-none whitespace-nowrap " +
          stateClass,
        contenteditable: "false",
        // Only resolved chips get a button role for accessibility.
        role: hasTitle ? "button" : undefined,
        tabindex: hasTitle ? "0" : undefined,
      },
      label,
    ];
  },

  renderText({ node }) {
    const { tag_prefix, ref_no } = node.attrs as TagChipAttrs;
    return `{${tag_prefix}:${ref_no}}`;
  },
});
