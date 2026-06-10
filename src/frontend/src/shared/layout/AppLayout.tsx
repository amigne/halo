import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useBreakpoint } from "./use-breakpoint";
import type { Breakpoint } from "./use-breakpoint";
import { Topbar } from "./Topbar";
import { SideMenu } from "./SideMenu";
import { Footer } from "./Footer";
import { ModalHost } from "@/shared/modal/ModalHost";

/**
 * Default collapsed state per breakpoint (spec §2, U-013):
 * - Desktop (>=1024): expanded by default (collapsed = false)
 * - Tablet (769-1023): icon-only by default (collapsed = true)
 * - Smartphone (<=768): drawer closed by default (mobileOpen = false)
 */
const DEFAULTS: Record<Breakpoint, boolean> = {
  smartphone: true, // Always "hidden" on smartphone (drawer closed)
  tablet: true, // Icon-only (collapsed) by default
  desktop: false, // Expanded by default
};

function storageKey(bp: Breakpoint): string {
  return `halo.menu-collapsed.${bp}`;
}

function readStored(bp: Breakpoint): boolean | null {
  const raw = localStorage.getItem(storageKey(bp));
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null; // No stored preference
}

function writeStored(bp: Breakpoint, value: boolean): void {
  localStorage.setItem(storageKey(bp), String(value));
}

/**
 * Main application layout — spec §1, §2 (U-010..U-014).
 *
 * Three-panel layout: Topbar (fixed), SideMenu (left), main content + Footer.
 * Adapts to the 3 breakpoints defined in spec §2.
 *
 * Persistence per mode (U-012): collapsed state is stored per breakpoint.
 * On breakpoint crossing, the saved preference is restored (or the default
 * for that mode if no preference has been saved yet). Manual toggles are
 * persisted immediately.
 */
export function AppLayout() {
  const { t } = useTranslation();
  const bp = useBreakpoint();

  // ── Collapsed state per breakpoint ──────────────────────────────────
  // Initialize from localStorage (or default). Each breakpoint tracks
  // its own preference independently.
  const [collapsedByBp, setCollapsedByBp] = useState<
    Record<Breakpoint, boolean>
  >(() => ({
    smartphone: true,
    tablet: readStored("tablet") ?? DEFAULTS.tablet,
    desktop: readStored("desktop") ?? DEFAULTS.desktop,
  }));

  // Mobile drawer open state (smartphone only)
  const [mobileOpen, setMobileOpen] = useState(false);

  // When the breakpoint changes, load the stored preference for the new
  // breakpoint (or its default if none exists).
  // This handles the case where the user is on a different device or
  // browser session — the localStorage values are already read at init,
  // but we need to ensure defaults for modes never visited.
  useEffect(() => {
    setCollapsedByBp((prev) => {
      // Only update if this breakpoint wasn't explicitly set yet
      // (first visit to this breakpoint in this session)
      const stored = readStored(bp);
      if (stored !== null) {
        return { ...prev, [bp]: stored };
      }
      // Use default, but don't overwrite a previously-set value
      if (prev[bp] === undefined || prev[bp] === null) {
        return { ...prev, [bp]: DEFAULTS[bp] };
      }
      return prev;
    });
  }, [bp]);

  // Close mobile drawer when switching to non-smartphone modes
  useEffect(() => {
    if (bp !== "smartphone") {
      setMobileOpen(false);
    }
  }, [bp]);

  const collapsed = collapsedByBp[bp] ?? DEFAULTS[bp];

  const toggleCollapse = useCallback(() => {
    setCollapsedByBp((prev) => {
      const next = !prev[bp];
      writeStored(bp, next);
      return { ...prev, [bp]: next };
    });
  }, [bp]);

  const handleHamburgerClick = useCallback(() => {
    setMobileOpen((o) => !o);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  // Memoize to avoid re-renders of children
  const sideMenu = useMemo(
    () => (
      <SideMenu
        breakpoint={bp}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileClose}
      />
    ),
    [bp, collapsed, toggleCollapse, mobileOpen, handleMobileClose],
  );

  return (
    <div className="min-h-screen bg-surface text-text flex flex-col">
      {/* ── Skip-to-content link (WCAG 2.2 AA — U-121) ──────────── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-tooltip)] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-contrast focus:rounded-md focus:shadow-md focus:outline-none"
      >
        {t("layout.skipToContent")}
      </a>

      {/* ── Topbar — fixed at top ─────────────────────────────────── */}
      <Topbar
        breakpoint={bp}
        onHamburgerClick={handleHamburgerClick}
        mobileOpen={mobileOpen}
      />

      {/* ── Body: sidebar + main content ──────────────────────────── */}
      <div className="flex flex-1">
        {/* Sidebar: static on desktop/tablet, slide-in on smartphone */}
        {sideMenu}

        {/* Main content area */}
        <main id="main-content" className="flex-1 p-4 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <Footer />

      {/* ── Modal host ────────────────────────────────────────────── */}
      <ModalHost />
    </div>
  );
}
