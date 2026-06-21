/**
 * TipTap custom inline node that renders a ``{PREFIX:ref_no}`` tag as a
 * styled, non-editable **chip** (étape 5-4 → 5-6).
 *
 * States
 * ------
 * - **unresolved** (``title === null``) — plain ``{PREFIX:ref_no}``,
 *   neutral styling, not clickable.
 * - **resolved** (``title`` is a string) — ``{PREFIX:ref_no — Title}``,
 *   clickable → opens cross-module detail modal (U-084).
 * - **broken** (``broken === true``) — ``{PREFIX:ref_no — (deleted)}``,
 *   muted styling, not clickable (F-071/U-085).
 *
 * Text serialization
 * ------------------
 * ``renderText`` returns ``{PREFIX:ref_no}`` so that document traversal
 * produces the raw storage representation.
 */

import {
  Node,
  nodeInputRule,
  nodePasteRule,
} from "@tiptap/core";

export interface TagChipAttrs {
  tag_prefix: string;
  ref_no: number;
  title: string | null;
  uuid: string | null;
  /** ``true`` when the referenced object no longer exists. */
  broken: boolean;
}

export interface TagChipOptions {
  /** i18n label displayed for broken (deleted) tags, e.g. ``"(supprimé)"``. */
  brokenLabel: string;
}

// Regex matching a complete tag — used by InputRule, PasteRule, and rawTextToDoc.
const TAG_PATTERN = /\{([A-Z]+):([1-9][0-9]*)\}/g;

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
      broken: {
        default: false,
        parseHTML: (el) => el.dataset.broken === "true",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-tag-chip]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { tag_prefix, ref_no, title, broken } = node.attrs as TagChipAttrs;
    const hasTitle = !broken && title !== null;

    let label: string;
    if (broken) {
      label = `${tag_prefix}:${ref_no} — (${this.options.brokenLabel})`;
    } else if (hasTitle) {
      label = `${tag_prefix}:${ref_no} — ${title}`;
    } else {
      label = `${tag_prefix}:${ref_no}`;
    }

    const stateClass = broken
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
        "data-uuid": (node.attrs as TagChipAttrs).uuid ?? "",
        "data-broken": String(broken),
        class:
          "tag-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md " +
          "bg-primary/10 text-primary font-medium text-sm " +
          "select-none whitespace-nowrap " +
          stateClass,
        contenteditable: "false",
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

  // ── Input / Paste rules ────────────────────────────────────────────────

  addInputRules() {
    return [
      nodeInputRule({
        // Matched at the END of typed text — the $ anchor catches
        // the moment the closing brace is typed.
        find: /\{([A-Z]+):([1-9][0-9]*)\}$/,
        type: this.type,
        getAttributes: (m) => ({
          tag_prefix: m[1],
          ref_no: Number(m[2]),
          title: null,
          uuid: null,
          broken: false,
        }),
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: TAG_PATTERN,
        type: this.type,
        getAttributes: (m) => ({
          tag_prefix: m[1],
          ref_no: Number(m[2]),
          title: null,
          uuid: null,
          broken: false,
        }),
      }),
    ];
  },
});
