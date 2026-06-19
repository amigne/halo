import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "@/shared/i18n/use-language";
import { useTheme } from "@/shared/theme/use-theme";
import { useAuth, useLogout } from "@/features/auth/auth-store";
import { BrandMark } from "./BrandMark";
import type { Breakpoint } from "./use-breakpoint";

interface TopbarProps {
  breakpoint: Breakpoint;
  onHamburgerClick: () => void;
  /** Whether the mobile drawer is open — used for aria-expanded (U-123). */
  mobileOpen: boolean;
}

/**
 * Topbar — spec §3 (U-020/U-021).
 *
 * Fixed at top. Contains: hamburger (smartphone), logo+title, language selector,
 * theme selector, bell placeholder, avatar → user menu.
 * All interactive surfaces have ≥ 44×44 px touch targets (U-014).
 */
export function Topbar({ breakpoint, onHamburgerClick, mobileOpen }: TopbarProps) {
  const { t } = useTranslation();
  const { lang, setLang } = useLanguage();
  const { pref, setPref } = useTheme();
  const { data: auth } = useAuth();
  const logout = useLogout();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  // Close user menu on outside click
  const handleUserMenuBlur = useCallback(
    (e: React.FocusEvent) => {
      // Close if focus leaves the menu container
      if (!userMenuRef.current?.contains(e.relatedTarget as Node)) {
        closeUserMenu();
      }
    },
    [closeUserMenu],
  );

  // Close user menu on Escape
  const handleUserMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") closeUserMenu();
    },
    [closeUserMenu],
  );

  const userInitials = auth?.user
    ? `${auth.user.first_name.charAt(0)}${auth.user.last_name.charAt(0)}`.toUpperCase()
    : "?";

  const isAdmin = auth?.user?.is_admin ?? false;

  return (
    <header
      className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-between border-b border-border bg-surface px-3 py-2"
      role="banner"
    >
      {/* ── Left group: hamburger + logo ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {breakpoint === "smartphone" && (
          <button
            type="button"
            onClick={onHamburgerClick}
            className="flex items-center justify-center rounded-md p-2 text-text hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] min-w-[44px] cursor-pointer"
            aria-label={t("layout.menu.close")}
            aria-expanded={mobileOpen}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        <Link
          to="/"
          className="flex items-center gap-2 rounded-md px-2 py-1 text-text no-underline hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px]"
          aria-label={t("layout.topbar.logoAriaLabel")}
        >
          <BrandMark />
          <h1 className="text-lg font-bold text-text">{t("app.title")}</h1>
        </Link>
      </div>

      {/* ── Right group: language, theme, bell, avatar ───────────────────── */}
      <div className="flex items-center gap-1">
        {/* Language selector */}
        <button
          type="button"
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          className="flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] min-w-[44px] cursor-pointer"
          aria-label={`${t("language.switchTo")}: ${t(lang === "fr" ? "language.en" : "language.fr")}`}
        >
          <span className="uppercase">{lang}</span>
        </button>

        {/* Theme selector — cycle light → dark → system */}
        <button
          type="button"
          onClick={() => {
            const cycle: Array<typeof pref> = ["light", "dark", "system"];
            const idx = cycle.indexOf(pref);
            setPref(cycle[(idx + 1) % cycle.length]!);
          }}
          className="flex items-center justify-center rounded-md px-2 py-2 text-text hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] min-w-[44px] cursor-pointer"
          aria-label={`${t("theme.light")}/${t("theme.dark")}/${t("theme.system")}`}
        >
          {/* Sun / Moon / Monitor icon based on current pref */}
          {pref === "light" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          {pref === "dark" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {pref === "system" && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
              <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Bell notification — placeholder, no logic (step 6) */}
        <button
          type="button"
          className="flex items-center justify-center rounded-md p-2 text-text-muted hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] min-w-[44px] cursor-pointer"
          aria-label={t("layout.topbar.notifications")}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M13.73 21a2 2 0 0 1-3.46 0"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Avatar + user menu */}
        <div
          className="relative"
          ref={userMenuRef}
          onBlur={handleUserMenuBlur}
          onKeyDown={handleUserMenuKeyDown}
        >
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center justify-center rounded-full bg-primary text-primary-contrast font-medium hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 focus-visible:outline-none min-h-[44px] min-w-[44px] cursor-pointer"
            aria-label={
              auth?.user
                ? `${auth.user.first_name} ${auth.user.last_name}`
                : t("auth.login")
            }
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            <span className="text-sm">{userInitials}</span>
          </button>

          {/* Dropdown menu */}
          {userMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-surface shadow-md z-[var(--z-dropdown)]"
            >
              {/* Settings page (step 3-9) */}
              <a
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] cursor-pointer no-underline"
                role="menuitem"
                onClick={closeUserMenu}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                </svg>
                {t("layout.topbar.userMenu.profile")}
              </a>

              {/* Admin placeholder — visible only for admins (route added in step 7) */}
              {isAdmin && (
                <a
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] cursor-pointer no-underline"
                  role="menuitem"
                  onClick={closeUserMenu}
                >
                  <svg
                    width="16"
                    height="16"
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
                  {t("layout.menu.admin")}
                </a>
              )}

              <hr className="border-border my-1" />

              {/* Logout */}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none min-h-[44px] cursor-pointer"
                role="menuitem"
                onClick={async () => {
                  closeUserMenu();
                  await logout();
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="16 17 21 12 16 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <line
                    x1="21"
                    y1="12"
                    x2="9"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {t("layout.topbar.userMenu.logout")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
