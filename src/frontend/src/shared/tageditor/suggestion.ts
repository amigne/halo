/**
 * TipTap suggestion extension triggered by ``{`` for tag autocompletion.
 *
 * Implements specs/02 §8 (U-080..U-083, U-087) and F-064..F-066:
 * - ``{`` opens the popup
 * - 1-char query → types whose prefix matches + objects
 * - ≥ 2 chars → objects only
 * - ↑↓ navigate, Enter select, Escape dismiss
 */

import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, {
  type SuggestionKeyDownProps,
} from "@tiptap/suggestion";

import type { SearchResponse } from "./api";
import { searchRefs } from "./api";

// ── Item types ───────────────────────────────────────────────────────────────

/** A type/prefix suggestion (e.g. ``{LIST``). */
interface TypeItem {
  kind: "type";
  prefix: string;
}

/** An object/title suggestion (e.g. ``{LIST:3 — Courses}``). */
interface ObjectItem {
  kind: "object";
  tag_prefix: string;
  ref_no: number;
  uuid: string;
  title: string;
}

type SuggestionItem = TypeItem | ObjectItem;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildItems(data: SearchResponse): SuggestionItem[] {
  const types: TypeItem[] = data.types.map((t) => ({
    kind: "type" as const,
    prefix: t.prefix,
  }));
  const objects: ObjectItem[] = data.items.map((i) => ({
    kind: "object" as const,
    tag_prefix: i.tag_prefix,
    ref_no: i.ref_no,
    uuid: i.uuid,
    title: i.title,
  }));
  return [...types, ...objects];
}

// ── DOM builders ─────────────────────────────────────────────────────────────

function createPopover(): HTMLElement {
  const el = document.createElement("div");
  el.className =
    "tag-suggestion-popover absolute z-50 w-72 max-h-64 overflow-y-auto " +
    "rounded-lg border border-border bg-surface shadow-lg " +
    "p-1";
  el.setAttribute("role", "listbox");
  el.setAttribute("aria-label", "Tag autocomplete");
  return el;
}

function createItem(
  item: SuggestionItem,
  index: number,
  isSelected: boolean,
): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "option");
  el.setAttribute("aria-selected", String(isSelected));
  el.setAttribute("data-index", String(index));

  const base =
    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer " +
    "[@media(pointer:coarse)]:min-h-11";
  const selected = isSelected ? " bg-primary/15 text-primary" : " text-text";
  const hover = " hover:bg-surface-alt";
  el.className = base + selected + hover;

  if (item.kind === "type") {
    el.innerHTML =
      '<span class="shrink-0 text-xs font-mono text-text-muted bg-surface-alt ' +
      'px-1 py-0.5 rounded">Type</span>' +
      `<span class="font-mono font-medium">{<span class="text-primary">${escapeHtml(item.prefix)}</span></span>`;
  } else {
    el.innerHTML =
      '<span class="shrink-0 text-xs font-mono text-text-muted bg-surface-alt ' +
      `px-1 py-0.5 rounded">{${escapeHtml(item.tag_prefix)}:${item.ref_no}</span>` +
      `<span class="truncate">${escapeHtml(item.title)}</span>`;
  }

  return el;
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

// ── Extension ────────────────────────────────────────────────────────────────

export const TagSuggestion = Extension.create({
  name: "tagSuggestion",

  addProseMirrorPlugins() {
    return [
      Suggestion<SuggestionItem, SuggestionItem>({
        editor: this.editor,
        char: "{",
        pluginKey: new PluginKey("tagSuggestionPlugin"),
        debounce: 150,

        allow({ editor }) {
          // Only trigger in TagEditor instances.
          return editor.view.dom.closest("[data-tag-editor]") !== null;
        },

        async items({ query, signal }) {
          try {
            const data = await searchRefs(query, signal);
            return buildItems(data);
          } catch {
            return [];
          }
        },

        command({ editor, range, props }) {
          if (props.kind === "type") {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(`{${props.prefix}:`)
              .run();
          } else {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(`{${props.tag_prefix}:${props.ref_no}}`)
              .run();
          }
        },

        render() {
          let popover: HTMLElement | null = null;
          let currentItems: SuggestionItem[] = [];
          let selectedIndex = 0;
          let unmount: (() => void) | null = null;
          let capturedCommand: ((item: SuggestionItem) => void) | null = null;

          function renderList() {
            if (!popover) return;
            popover.innerHTML = "";

            if (currentItems.length === 0) {
              const empty = document.createElement("div");
              empty.className =
                "px-2 py-3 text-sm text-text-muted text-center";
              empty.textContent = "No matching tags";
              popover.appendChild(empty);
              return;
            }

            currentItems.forEach((item, idx) => {
              const el = createItem(item, idx, idx === selectedIndex);
              el.addEventListener("click", () => {
                capturedCommand?.(item);
              });
              el.addEventListener("mouseenter", () => {
                selectedIndex = idx;
                renderList();
              });
              popover!.appendChild(el);
            });
          }

          return {
            onStart(props) {
              currentItems = props.items;
              capturedCommand = props.command;
              selectedIndex = 0;
              popover = createPopover();
              renderList();
              unmount = props.mount(popover);
            },

            onUpdate(props) {
              currentItems = props.items;
              capturedCommand = props.command;
              if (selectedIndex >= props.items.length) {
                selectedIndex = Math.max(0, props.items.length - 1);
              }
              renderList();
            },

            onExit() {
              if (unmount) {
                unmount();
                unmount = null;
              }
              popover = null;
              currentItems = [];
              capturedCommand = null;
              selectedIndex = 0;
            },

            onKeyDown(props: SuggestionKeyDownProps): boolean {
              if (props.event.key === "ArrowDown") {
                props.event.preventDefault();
                selectedIndex = Math.min(
                  selectedIndex + 1,
                  currentItems.length - 1,
                );
                renderList();
                return true;
              }

              if (props.event.key === "ArrowUp") {
                props.event.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderList();
                return true;
              }

              if (props.event.key === "Enter") {
                props.event.preventDefault();
                const item = currentItems[selectedIndex];
                if (item && capturedCommand) {
                  capturedCommand(item);
                }
                return true;
              }

              return false;
            },
          };
        },
      }),
    ];
  },
});
