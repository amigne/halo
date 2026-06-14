import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ICONS, ICON_KEYS } from "./icon-data";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface IconPickerProps {
  /** Currently selected icon key (empty string = none). */
  value: string;
  /** Called when the user selects an icon. */
  onChange: (iconKey: string) => void;
  /** Optional label for the picker. */
  label?: string;
  /** Whether the picker is disabled. */
  disabled?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const GRID_COLS = 8;

/** Render a single icon SVG at the given size. */
function IconSvg({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * IconPicker — functional icon picker with searchable SVG gallery.
 *
 * Features:
 * - ~60 built-in SVG icons (Feather/Lucide style, currentColor for theming)
 * - Search by name with real-time filtering
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Accessible: role="listbox", aria-selected, aria-label
 * - Light/dark theming via CSS tokens (currentColor inherits)
 * - Public API unchanged from étape 3-10 stub (value/onChange)
 */
export function IconPicker({
  value,
  onChange,
  label,
  disabled = false,
}: IconPickerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const listboxId = useId();

  // ── Filtered icons ───────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return ICON_KEYS;
    return ICON_KEYS.filter((key) => {
      const def = ICONS[key];
      if (!def) return false;
      const matchName = key.toLowerCase().includes(q);
      const matchCategory = def.category.toLowerCase().includes(q);
      const matchKeywords =
        def.keywords?.some((kw: string) =>
          kw.toLowerCase().includes(q),
        ) ?? false;
      return matchName || matchCategory || matchKeywords;
    });
  }, [search]);

  // Reset focus index when filtered results change
  useEffect(() => {
    setFocusIndex(0);
  }, [filtered.length]);

  // ── Open / close ─────────────────────────────────────────────────────────

  const open = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    // Focus search input after the popover renders
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [disabled]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: Event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, close]);

  // ── Selection ────────────────────────────────────────────────────────────

  const select = useCallback(
    (key: string) => {
      onChange(key);
      close();
    },
    [onChange, close],
  );

  // ── Keyboard handling ────────────────────────────────────────────────────

  const handleTriggerKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        open();
      }
    },
    [open],
  );

  const handlePopoverKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && filtered[focusIndex]) {
        e.preventDefault();
        select(filtered[focusIndex]!);
        return;
      }
    },
    [filtered, focusIndex, select, close],
  );

  // Focus the grid button at focusIndex
  useEffect(() => {
    if (!isOpen || !gridRef.current) return;
    const buttons = gridRef.current.querySelectorAll<HTMLButtonElement>(
      '[role="option"]',
    );
    buttons[focusIndex]?.focus();
  }, [isOpen, focusIndex]);

  // ── Render ───────────────────────────────────────────────────────────────

  const selectedPath = value ? ICONS[value]?.path : null;

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
    >
      {/* Trigger button — shows selected or placeholder icon */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={open}
          className={`flex items-center justify-center w-10 h-10 rounded-md border border-border bg-surface shrink-0 transition-colors hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] min-w-[44px] ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          }`}
          aria-label={label ?? t("ui.iconPicker.placeholder")}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onKeyDown={handleTriggerKeyDown}
        >
          {selectedPath ? (
            <IconSvg path={selectedPath} />
          ) : (
            <span
              className="text-lg text-text-muted opacity-40"
              aria-hidden="true"
            >
              +
            </span>
          )}
        </button>

        {/* Hidden input for form compatibility (read-only visual) */}
        <input
          type="text"
          value={value}
          disabled={disabled}
          readOnly
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
        />
      </div>

      {/* Popover */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-[var(--z-modal)] bg-surface border border-border rounded-lg shadow-lg p-3 w-[340px] max-w-[calc(100vw-2rem)]"
          role="dialog"
          aria-label={label ?? t("ui.iconPicker.placeholder")}
          onKeyDown={handlePopoverKeyDown}
        >
          {/* Search input */}
          <div className="mb-3">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("ui.iconPicker.placeholder")}
              aria-label={t("ui.iconPicker.placeholder")}
              className="min-h-[44px] w-full px-3 py-2 rounded-md border bg-surface text-text placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none border-border"
            />
          </div>

          {/* Icon grid */}
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              {t("ui.emptyState.noResults")}
            </p>
          ) : (
            <div
              ref={gridRef}
              role="listbox"
              id={listboxId}
              aria-label={label ?? t("ui.iconPicker.placeholder")}
              className="grid gap-1 max-h-[280px] overflow-y-auto"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              }}
            >
              {filtered.map((key) => {
                const def = ICONS[key];
                if (!def) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={key === value}
                    aria-label={key}
                    tabIndex={-1}
                    onClick={() => select(key)}
                    className={`flex items-center justify-center w-full aspect-square rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${
                      key === value
                        ? "bg-primary text-primary-contrast"
                        : "text-text hover:bg-border"
                    }`}
                  >
                    <IconSvg path={def.path} size={18} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
