import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BrandMark } from "./BrandMark";

/**
 * Centered auth card layout — no app chrome (no topbar/menu/footer).
 *
 * Renders a single card on the canvas with brand mark + Halo title,
 * then the auth page content (form, links) via <Outlet />.
 */
export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <BrandMark size={32} />
          <span className="text-lg font-semibold text-text">{t("app.title")}</span>
        </div>
        <Outlet />
      </div>
    </main>
  );
}
