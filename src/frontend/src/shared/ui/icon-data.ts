/**
 * Icon data — SVG path definitions for the IconPicker and related components.
 *
 * Style: Feather/Lucide-inspired, 24×24 viewBox, stroke-width 2,
 * currentColor, round caps & joins, fill="none".
 *
 * Organized by category for easy browsing in the picker.
 */

export interface IconDef {
  /** SVG path data (the `d` attribute of a `<path>` element). */
  path: string;
  /** Category for grouping in the picker. */
  category: string;
  /** Additional search keywords (beyond the key itself). */
  keywords?: string[];
}

/** All icons keyed by their stable identifier (used as the `value` in IconPicker). */
export const ICONS: Record<string, IconDef> = {
  // ── Actions (12) ──────────────────────────────────────────────────────────

  plus: {
    path: "M12 5v14M5 12h14",
    category: "actions",
    keywords: ["add", "new", "create"],
  },
  "plus-circle": {
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v8M8 12h8",
    category: "actions",
    keywords: ["add", "new"],
  },
  minus: {
    path: "M5 12h14",
    category: "actions",
    keywords: ["remove", "delete", "subtract"],
  },
  "minus-circle": {
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM8 12h8",
    category: "actions",
    keywords: ["remove", "delete"],
  },
  x: {
    path: "M18 6 6 18M6 6l12 12",
    category: "actions",
    keywords: ["close", "delete", "remove", "cancel", "clear"],
  },
  check: {
    path: "M20 6 9 17l-5-5",
    category: "actions",
    keywords: ["done", "confirm", "valid", "ok", "tick"],
  },
  pencil: {
    path: "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z",
    category: "actions",
    keywords: ["edit", "write", "modify"],
  },
  trash: {
    path: "M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2",
    category: "actions",
    keywords: ["delete", "remove", "bin"],
  },
  copy: {
    path: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1M15 9h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z",
    category: "actions",
    keywords: ["duplicate", "clone"],
  },
  search: {
    path: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
    category: "actions",
    keywords: ["find", "magnify", "lookup"],
  },
  download: {
    path: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    category: "actions",
    keywords: ["save", "export"],
  },
  upload: {
    path: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    category: "actions",
    keywords: ["import", "share"],
  },

  // ── Navigation (6) ───────────────────────────────────────────────────────

  "chevron-left": {
    path: "m15 18-6-6 6-6",
    category: "navigation",
    keywords: ["back", "previous", "arrow"],
  },
  "chevron-right": {
    path: "m9 18 6-6-6-6",
    category: "navigation",
    keywords: ["next", "forward", "arrow"],
  },
  "chevron-up": {
    path: "m18 15-6-6-6 6",
    category: "navigation",
    keywords: ["collapse", "arrow"],
  },
  "chevron-down": {
    path: "m6 9 6 6 6-6",
    category: "navigation",
    keywords: ["expand", "arrow"],
  },
  "arrow-left": {
    path: "M12 19l-7-7 7-7M19 12H5",
    category: "navigation",
    keywords: ["back", "previous"],
  },
  "arrow-right": {
    path: "M12 5l7 7-7 7M5 12h14",
    category: "navigation",
    keywords: ["next", "forward"],
  },

  // ── Objects (16) ─────────────────────────────────────────────────────────

  star: {
    path: "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z",
    category: "objects",
    keywords: ["favorite", "important", "bookmark"],
  },
  heart: {
    path: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    category: "objects",
    keywords: ["like", "love", "favorite"],
  },
  flag: {
    path: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
    category: "objects",
    keywords: ["report", "priority", "milestone"],
  },
  bookmark: {
    path: "m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z",
    category: "objects",
    keywords: ["save", "favorite", "pin"],
  },
  book: {
    path: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
    category: "objects",
    keywords: ["read", "manual", "documentation"],
  },
  calendar: {
    path: "M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4",
    category: "objects",
    keywords: ["date", "event", "schedule"],
  },
  clock: {
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
    category: "objects",
    keywords: ["time", "schedule", "deadline", "due"],
  },
  bell: {
    path: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
    category: "objects",
    keywords: ["notification", "alert", "reminder"],
  },
  tag: {
    path: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42l-8.704-8.704zM7 7h.01",
    category: "objects",
    keywords: ["label", "category", "classify"],
  },
  folder: {
    path: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z",
    category: "objects",
    keywords: ["directory", "category", "group"],
  },
  file: {
    path: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7zM13 2v7h7",
    category: "objects",
    keywords: ["document", "page", "text"],
  },
  paperclip: {
    path: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
    category: "objects",
    keywords: ["attach", "attachment", "link"],
  },
  pin: {
    path: "M12 22v-8m0 0-5-3V5h10v6l-5 3zM9 5V3h6v2",
    category: "objects",
    keywords: ["location", "map", "marker"],
  },
  key: {
    path: "m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
    category: "objects",
    keywords: ["password", "security", "access"],
  },
  lock: {
    path: "M7 11V7a5 5 0 0 1 10 0v4M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
    category: "objects",
    keywords: ["security", "private", "closed"],
  },
  unlock: {
    path: "M7 11V7a5 5 0 0 1 9.9-1M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z",
    category: "objects",
    keywords: ["open", "public", "access"],
  },

  // ── Symbols (8) ──────────────────────────────────────────────────────────

  "check-circle": {
    path: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
    category: "symbols",
    keywords: ["success", "done", "complete", "approved"],
  },
  "x-circle": {
    path: "M9 9l6 6m0-6-6 6m10-3a10 10 0 1 1-20 0 10 10 0 0 1 20 0z",
    category: "symbols",
    keywords: ["error", "fail", "invalid", "rejected"],
  },
  "alert-circle": {
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01",
    category: "symbols",
    keywords: ["warning", "caution", "attention"],
  },
  info: {
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01",
    category: "symbols",
    keywords: ["information", "help", "about"],
  },
  "question-circle": {
    path: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
    category: "symbols",
    keywords: ["help", "faq", "support"],
  },
  lightbulb: {
    path: "M9 18h6M10 22h4M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z",
    category: "symbols",
    keywords: ["idea", "tip", "insight"],
  },
  eye: {
    path: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    category: "symbols",
    keywords: ["view", "visible", "show"],
  },
  "eye-off": {
    path: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
    category: "symbols",
    keywords: ["hide", "hidden", "invisible"],
  },

  // ── People (4) ───────────────────────────────────────────────────────────

  user: {
    path: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    category: "people",
    keywords: ["person", "account", "profile"],
  },
  users: {
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    category: "people",
    keywords: ["group", "team", "members", "people"],
  },
  "user-plus": {
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM19 7v6M22 10h-6",
    category: "people",
    keywords: ["add", "invite", "member"],
  },
  "user-check": {
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 11l2 2 4-4",
    category: "people",
    keywords: ["verified", "confirmed", "member"],
  },

  // ── Layout (8) ───────────────────────────────────────────────────────────

  grid: {
    path: "M3 3h7v7H3V3zM14 3h7v7h-7V3zM14 14h7v7h-7v-7zM3 14h7v7H3v-7z",
    category: "layout",
    keywords: ["cards", "tiles", "dashboard"],
  },
  list: {
    path: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    category: "layout",
    keywords: ["rows", "bullet", "items"],
  },
  columns: {
    path: "M12 3v18M3 3h18v18H3V3zM3 12h18",
    category: "layout",
    keywords: ["layout", "split", "panes"],
  },
  sidebar: {
    path: "M3 3h18v18H3V3zM9 3v18",
    category: "layout",
    keywords: ["panel", "nav", "drawer"],
  },
  menu: {
    path: "M3 12h18M3 6h18M3 18h18",
    category: "layout",
    keywords: ["hamburger", "navigation", "burger"],
  },
  "more-horizontal": {
    path: "M12 12h.01M19 12h.01M5 12h.01",
    category: "layout",
    keywords: ["dots", "more", "overflow", "options"],
  },
  "more-vertical": {
    path: "M12 5h.01M12 12h.01M12 19h.01",
    category: "layout",
    keywords: ["dots", "more", "overflow", "options"],
  },
  maximize: {
    path: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
    category: "layout",
    keywords: ["fullscreen", "expand", "enlarge"],
  },

  // ── Communication (6) ────────────────────────────────────────────────────

  mail: {
    path: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
    category: "communication",
    keywords: ["email", "message", "contact"],
  },
  "mail-open": {
    path: "M21.5 12H22v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7h.5M12 2 2 9h20L12 2zM12 2v7.5",
    category: "communication",
    keywords: ["email", "read", "inbox"],
  },
  chat: {
    path: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z",
    category: "communication",
    keywords: ["message", "comment", "discussion"],
  },
  "chat-dots": {
    path: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10zM9 10h.01M12 10h.01M15 10h.01",
    category: "communication",
    keywords: ["message", "typing", "conversation"],
  },
  send: {
    path: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z",
    category: "communication",
    keywords: ["share", "forward", "submit", "paper-plane"],
  },
  phone: {
    path: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
    category: "communication",
    keywords: ["call", "contact", "support"],
  },
};

/** Sorted array of icon keys for display ordering. */
export const ICON_KEYS = Object.keys(ICONS).sort();

/** All distinct categories. */
export const ICON_CATEGORIES = [...new Set(Object.values(ICONS).map((i) => i.category))];

/** Get the SVG path for an icon key, or null if not found. */
export function getIconPath(key: string): string | null {
  return ICONS[key]?.path ?? null;
}
