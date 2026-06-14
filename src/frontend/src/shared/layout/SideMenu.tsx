import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/auth-store";
import { Tooltip } from "@/shared/ui/Tooltip";
import type { Breakpoint } from "./use-breakpoint";

interface SideMenuProps {
  breakpoint: Breakpoint;
  /** Whether the menu is in collapsed/icon-only state (desktop/tablet). */
  collapsed: boolean;
  /** Toggle collapsed state for desktop/tablet. */
  onToggleCollapse: () => void;
  /** Whether the mobile drawer is open (smartphone). */
  mobileOpen: boolean;
  /** Close the mobile drawer. */
  onMobileClose: () => void;
}

/**
 * SideMenu — spec §4 (U-040..U-045).
 *
 * Three modes per breakpoint:
 * - Desktop (>=1024): full sidebar (icons + labels), collapsible to icon-only
 * - Tablet (769-1023): icon-only by default, expandable to full
 * - Smartphone (<=768): hidden by default, slide-in drawer via hamburger
 *
 * Modules area is empty (modules arrive in later steps).
 * Admin entry is visible only for admin users and anchored at bottom (U-042).
 */
export function SideMenu({
  breakpoint,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SideMenuProps) {
  const { t } = useTranslation();
  const { data: auth } = useAuth();
  const location = useLocation();
  const drawerRef = useRef<HTMLElement>(null);

  const isAdmin = auth?.user?.is_admin ?? false;
  const modules: Array<{ key: string; label: string; iconKey: string; path: string }> = [
    { key: "lists", label: t("modules.lists"), iconKey: "list", path: "/lists" },
  ];

  // Close mobile drawer on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        onMobileClose();
      }
    },
    [mobileOpen, onMobileClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Trap focus inside mobile drawer when open
  useEffect(() => {
    if (!mobileOpen || breakpoint !== "smartphone") return;

    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusable = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleTrap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    drawer.addEventListener("keydown", handleTrap);
    first?.focus();

    return () => drawer.removeEventListener("keydown", handleTrap);
  }, [mobileOpen, breakpoint]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen && breakpoint === "smartphone") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, breakpoint]);

  // Determine visibility
  const isSmartphone = breakpoint === "smartphone";
  const showLabels = isSmartphone
    ? true // full labels in drawer
    : !collapsed; // depends on collapsed state

  // ── Reusable menu entry ─────────────────────────────────────────────
  function MenuEntry({
    icon,
    label,
    path,
    hideLabel,
  }: {
    icon: React.ReactNode;
    label: string;
    path: string;
    hideLabel: boolean;
  }) {
    const isActive =
      location.pathname === path || location.pathname.startsWith(path + "/");

    const inner = (
      <Link
        to={path}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium no-underline transition-colors min-h-[44px] cursor-pointer ${
          isActive
            ? "bg-primary text-primary-contrast"
            : "text-text hover:bg-border"
        } focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none`}
        aria-current={isActive ? "page" : undefined}
        onClick={isSmartphone ? onMobileClose : undefined}
      >
        <span className="flex-shrink-0 flex items-center justify-center w-5 h-5">
          {icon}
        </span>
        {!hideLabel && <span className="truncate">{label}</span>}
      </Link>
    );

    if (hideLabel) {
      return (
        <Tooltip content={label} position="right">
          {inner}
        </Tooltip>
      );
    }

    return inner;
  }

  // ── Build render tree ────────────────────────────────────────────────

  // Module icon placeholder — generic "box" icon
  const moduleIcon = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="3.27 6.96 12 12.01 20.73 6.96"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  // Per-module icons — small set for sidebar entries
  const MODULE_ICONS: Record<string, React.ReactNode> = {
    list: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  };

  const sidebarContent = (
    <nav
      ref={isSmartphone ? drawerRef : undefined}
      className={`flex flex-col h-full ${showLabels ? "w-56" : "w-14"} transition-width duration-200 motion-reduce:duration-[0.01ms]`}
      aria-label={t("layout.menu.modules")}
    >
      {/* ── Collapse/Expand toggle (desktop/tablet only) ──────────────── */}
      {!isSmartphone && (
        <div className="px-1 pt-2 pb-1">
          <Tooltip
            content={
              collapsed
                ? t("layout.menu.expand")
                : t("layout.menu.collapse")
            }
            position="right"
          >
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-full rounded-md py-2 text-text-muted hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] cursor-pointer"
              aria-label={
                collapsed
                  ? t("layout.menu.expand")
                  : t("layout.menu.collapse")
              }
            >
              {collapsed ? (
                /* Chevron right — expand */
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    points="9 18 15 12 9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                /* Chevron left — collapse */
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    points="15 18 9 12 15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </Tooltip>
        </div>
      )}

      {/* ── Modules section ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-1 py-1 space-y-1">
        {showLabels && (
          <div className="px-3 py-1 text-xs font-semibold text-text-muted uppercase tracking-wide">
            {t("layout.menu.modules")}
          </div>
        )}
        {modules.map((mod) => (
          <MenuEntry
            key={mod.key}
            icon={MODULE_ICONS[mod.iconKey] ?? moduleIcon}
            label={mod.label}
            path={mod.path}
            hideLabel={!showLabels}
          />
        ))}
        {/* If no modules, show an empty state hint */}
        {modules.length === 0 && showLabels && (
          <p className="px-3 py-2 text-xs text-text-muted italic">
            {t("app.loading")}
          </p>
        )}
      </div>

      {/* ── Admin entry — anchored at bottom, admin only ────────────── */}
      {isAdmin && (
        <div className="border-t border-border px-1 py-1">
          <MenuEntry
            icon={
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            }
            label={t("layout.menu.admin")}
            path="/admin"
            hideLabel={!showLabels}
          />
        </div>
      )}
    </nav>
  );

  // ── Smartphone: render as slide-in drawer with overlay ────────────
  if (isSmartphone) {
    return (
      <>
        {/* Backdrop overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[var(--z-overlay)]"
            onClick={onMobileClose}
            aria-hidden="true"
          />
        )}
        {/* Slide-in drawer */}
        <aside
          className={`fixed top-0 left-0 h-full bg-surface border-r border-border z-[var(--z-modal)] transform transition-transform duration-200 motion-reduce:duration-[0.01ms] ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="navigation"
          aria-label={t("layout.menu.modules")}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  // ── Desktop/tablet: static sidebar ─────────────────────────────────
  return (
    <aside
      className="flex-shrink-0 border-r border-border bg-surface overflow-y-auto"
      role="navigation"
      aria-label={t("layout.menu.modules")}
    >
      {sidebarContent}
    </aside>
  );
}
