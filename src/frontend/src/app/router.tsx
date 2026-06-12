import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { HomePage } from "./routes/home";
import { NotFoundPage } from "./routes/not-found";
import { AppLayout } from "./App";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ListsPage } from "@/features/lists";

// ── Root route ──────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: AppLayout,
  validateSearch: (
    search: Record<string, unknown>,
  ): { modal?: string[] } => {
    const raw = search.modal;
    if (raw === undefined || raw === null) return {};
    if (Array.isArray(raw)) {
      const filtered = raw.filter((m): m is string => typeof m === "string");
      return filtered.length > 0 ? { modal: filtered } : {};
    }
    // Single string value — wrap in array
    if (typeof raw === "string" && raw.length > 0) {
      return { modal: [raw] };
    }
    return {};
  },
});

// ── Leaf routes ─────────────────────────────────────────────────────────────

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify-email",
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const listsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lists",
  component: ListsPage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: NotFoundPage,
});

// ── Route tree ──────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  verifyEmailRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  settingsRoute,
  listsRoute,
  notFoundRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundPage,
});

// Register the router for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
