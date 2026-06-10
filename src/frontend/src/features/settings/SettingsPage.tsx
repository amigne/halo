/**
 * Settings page — user profile, appearance, timezone, notification prefs.
 *
 * Specs/02 §2 F-020..F-024.  Uses useAutosaveField (3-7) for save-less
 * editing — each field persists on blur via PATCH /users/me.
 * Theme / language are synced with the same stores used by Topbar.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/auth-store";
import { useTheme } from "@/shared/theme/use-theme";
import { useLanguage } from "@/shared/i18n/use-language";
import { apiMutate } from "@/shared/api/fetch-wrapper";
import { AutosaveField } from "@/shared/autosave/AutosaveField";
import { Select } from "@/shared/ui/Select";
import { Toggle } from "@/shared/ui/Toggle";
import { useToast } from "@/shared/ui/Toast";
import { formatDateTime } from "@/shared/datetime/format";

// ── Types ──────────────────────────────────────────────────────────────────

interface NotificationPref {
  id: string;
  user_id: string;
  module_key: string;
  event_type: string;
  channel: "in_app" | "email";
  enabled: boolean;
}

type ThemePref = "light" | "dark" | "system";
type Locale = "fr" | "en";

// ── IANA timezone list ─────────────────────────────────────────────────────
// Curated set of common IANA timezones (Intl.supportedValuesOf is Chrome 121+).

const COMMON_TIMEZONES: string[] = [
  "UTC",
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Warsaw",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "America/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/Santiago",
  "America/Bogota",
  "America/Lima",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Seoul",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Jerusalem",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
  "Pacific/Fiji",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Casablanca",
];

// ── Notification event types (scaffold for étape 6) ───────────────────────

const NOTIFICATION_EVENTS = [
  "comment_added",
  "mention",
  "task_assigned",
  "status_changed",
] as const;

const NOTIFICATION_CHANNELS = ["in_app", "email"] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format current time in the given timezone + locale for the preview. */
function formatNow(tz: string, lang: string): string {
  const now = new Date().toISOString();
  return formatDateTime(now, tz, lang, {
    dateStyle: "full",
    timeStyle: "medium",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { t } = useTranslation();
  const { data: auth, isLoading: authLoading } = useAuth();
  const user = auth?.user;
  const { pref, setPref } = useTheme();
  const { lang, setLang } = useLanguage();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Local state for the timezone preview clock (updated every second).
  const [nowPreview, setNowPreview] = useState<string>("");

  const effectiveTz = user?.timezone ?? "UTC";

  // ── Hydrate theme / locale from server on load (U-100..U-104) ──────────
  // Server is the source of truth; localStorage is an anti-flash cache.

  useEffect(() => {
    if (!user) return;
    if (
      user.theme === "light" ||
      user.theme === "dark" ||
      user.theme === "system"
    ) {
      setPref(user.theme as ThemePref);
    }
    if (user.locale === "fr" || user.locale === "en") {
      setLang(user.locale as Locale);
    }
  }, [user?.theme, user?.locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timezone preview clock ──────────────────────────────────────────────

  useEffect(() => {
    const update = () => setNowPreview(formatNow(effectiveTz, lang));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [effectiveTz, lang]);

  // ── PATCH profile helper ────────────────────────────────────────────────

  const patchProfile = useCallback(
    async (partial: Record<string, string>) => {
      const resp = await apiMutate("/api/v1/users/me", {
        method: "PATCH",
        body: partial,
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(
          (body as { detail?: { message?: string } }).detail?.message ??
            `HTTP ${resp.status}`,
        );
      }
      // Invalidate auth cache so useAuth picks up the new values.
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    [queryClient],
  );

  // ── Theme change handler ─────────────────────────────────────────────────

  const handleThemeChange = useCallback(
    (next: string) => {
      const theme = next as ThemePref;
      setPref(theme); // Reflect instantly in Topbar (same store)
      patchProfile({ theme }).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);
        addToast("error", `${t("autosave.error")}: ${message}`);
      });
    },
    [setPref, patchProfile, addToast, t],
  );

  // ── Language change handler ──────────────────────────────────────────────

  const handleLangChange = useCallback(
    (next: string) => {
      const locale = next as Locale;
      setLang(locale); // Reflect instantly in Topbar (same store)
      patchProfile({ locale }).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);
        addToast("error", `${t("autosave.error")}: ${message}`);
      });
    },
    [setLang, patchProfile, addToast, t],
  );

  // ── Timezone change handler ──────────────────────────────────────────────

  const handleTimezoneChange = useCallback(
    (next: string) => {
      patchProfile({ timezone: next }).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);
        addToast("error", `${t("autosave.error")}: ${message}`);
      });
    },
    [patchProfile, addToast, t],
  );

  // ── Notification prefs query ─────────────────────────────────────────────
  // Uses raw fetch because the OpenAPI client hasn't been regenerated for
  // these new endpoints yet.  CSRF is not needed for GET.

  const prefsQuery = useQuery({
    queryKey: ["users", "me", "notification-prefs"],
    queryFn: async (): Promise<NotificationPref[]> => {
      const resp = await fetch("/api/v1/users/me/notification-prefs", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    enabled: !!user,
  });

  // Build a lookup map: `${event_type}|${channel}` → {enabled, id}
  const prefsMap = useMemo(() => {
    const prefs = prefsQuery.data ?? [];
    const map = new Map<string, { enabled: boolean; id: string }>();
    for (const p of prefs) {
      map.set(`${p.event_type}|${p.channel}`, { enabled: p.enabled, id: p.id });
    }
    return map;
  }, [prefsQuery.data]);

  // ── Toggle notification preference handler ───────────────────────────────

  const handlePrefToggle = useCallback(
    async (
      eventType: string,
      channel: "in_app" | "email",
      enabled: boolean,
    ) => {
      try {
        const resp = await apiMutate("/api/v1/users/me/notification-prefs", {
          method: "PUT",
          body: {
            module_key: "halo",
            event_type: eventType,
            channel,
            enabled,
          },
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          const detail = (body as { detail?: { message?: string } }).detail;
          const message = detail?.message ?? `HTTP ${resp.status}`;
          throw new Error(message);
        }
        // Invalidate the prefs query
        queryClient.invalidateQueries({
          queryKey: ["users", "me", "notification-prefs"],
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);
        addToast("error", `${t("autosave.error")}: ${message}`);
        // Re-invalidate to resync the toggle state with the server
        queryClient.invalidateQueries({
          queryKey: ["users", "me", "notification-prefs"],
        });
      }
    },
    [queryClient, addToast, t],
  );

  // ── Loading / unauthenticated states ─────────────────────────────────────

  if (authLoading) {
    return (
      <div className="p-6 text-text-muted" role="status">
        {t("app.loading")}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-text-muted" role="alert">
        {t("app.notFound")}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const themeOptions = [
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
    { value: "system", label: t("theme.system") },
  ];

  const langOptions = [
    { value: "fr", label: t("language.fr") },
    { value: "en", label: t("language.en") },
  ];

  const tzOptions = COMMON_TIMEZONES.map((tz) => ({
    value: tz,
    label: tz.replace("_", " "),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-text mb-6">{t("settings.title")}</h1>

      {/* ── Identity ───────────────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="settings-identity-title">
        <h2
          id="settings-identity-title"
          className="text-lg font-semibold text-text mb-4"
        >
          {t("settings.identity.title")}
        </h2>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <AutosaveField
            label={t("settings.identity.firstName")}
            value={user.first_name}
            fieldKey="first_name"
            onPatch={patchProfile}
          />

          <AutosaveField
            label={t("settings.identity.lastName")}
            value={user.last_name}
            fieldKey="last_name"
            onPatch={patchProfile}
          />

          {/* Email — readonly */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text">
              {t("settings.identity.email")}
            </label>
            <input
              type="email"
              value={user.email}
              readOnly
              disabled
              className="min-h-[44px] w-full px-3 py-2 rounded-md border bg-surface text-text-muted opacity-60 border-border"
            />
            <p className="text-xs text-text-muted">
              {t("settings.identity.emailReadonly")}
            </p>
          </div>
        </div>
      </section>

      {/* ── Appearance ─────────────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="settings-appearance-title">
        <h2
          id="settings-appearance-title"
          className="text-lg font-semibold text-text mb-4"
        >
          {t("settings.appearance.title")}
        </h2>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <Select
            label={t("settings.appearance.theme")}
            value={pref}
            onChange={handleThemeChange}
            options={themeOptions}
          />

          <Select
            label={t("settings.appearance.language")}
            value={lang}
            onChange={handleLangChange}
            options={langOptions}
          />
        </div>
      </section>

      {/* ── Timezone ───────────────────────────────────────────────────── */}
      <section className="mb-8" aria-labelledby="settings-timezone-title">
        <h2
          id="settings-timezone-title"
          className="text-lg font-semibold text-text mb-4"
        >
          {t("settings.timezone.title")}
        </h2>

        <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <Select
            label={t("settings.timezone.label")}
            value={effectiveTz}
            onChange={handleTimezoneChange}
            options={tzOptions}
          />

          {/* Live preview */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {t("settings.timezone.preview")}
            </span>
            <div
              className="min-h-[44px] flex items-center px-3 py-2 rounded-md border border-border bg-bg text-text"
              aria-live="polite"
              aria-label={t("settings.timezone.currentTime")}
            >
              {nowPreview || "—"}
            </div>
          </div>
        </div>
      </section>

      {/* ── Notification preferences (scaffold — no emission) ──────────── */}
      <section className="mb-8" aria-labelledby="settings-notifs-title">
        <h2
          id="settings-notifs-title"
          className="text-lg font-semibold text-text mb-2"
        >
          {t("settings.notifications.title")}
        </h2>
        <p className="text-sm text-text-muted mb-4">
          {t("settings.notifications.description")}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-text">
                  {t("settings.notifications.event")}
                </th>
                <th className="px-4 py-3 text-center font-medium text-text">
                  {t("settings.notifications.inApp")}
                </th>
                <th className="px-4 py-3 text-center font-medium text-text">
                  {t("settings.notifications.email")}
                </th>
              </tr>
            </thead>
            <tbody>
              {NOTIFICATION_EVENTS.map((eventType) => (
                <tr
                  key={eventType}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-3 text-text">
                    {t(`settings.notifications.events.${eventType}`)}
                  </td>
                  {NOTIFICATION_CHANNELS.map((channel) => {
                    const entry = prefsMap.get(`${eventType}|${channel}`);
                    const checked = entry?.enabled ?? true;
                    const cellId = `pref-${eventType}-${channel}`;
                    return (
                      <td key={channel} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            id={cellId}
                            checked={checked}
                            label=""
                            onChange={(enabled) =>
                              handlePrefToggle(eventType, channel, enabled)
                            }
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
