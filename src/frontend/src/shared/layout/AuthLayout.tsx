import { Outlet } from "@tanstack/react-router";

/** Layout minimal des pages d'auth : centré, sans chrome applicatif. */
export function AuthLayout() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface p-4">
      <Outlet />
    </main>
  );
}
