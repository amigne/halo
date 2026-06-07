import { Outlet } from "@tanstack/react-router";
import { ThemeSwitcher } from "@/shared/theme/ThemeSwitcher";
import { LanguageSwitcher } from "@/shared/i18n/LanguageSwitcher";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <header className="sticky top-0 z-topbar flex items-center justify-between border-b border-border bg-surface px-4 py-2">
        <h1 className="text-lg font-bold">Halo</h1>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
