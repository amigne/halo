import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { HomePage } from "./routes/home";
import { NotFoundPage } from "./routes/not-found";
import { RootLayout } from "@/shared/layout/RootLayout";
import { AuthLayout } from "@/shared/layout/AuthLayout";
import { ProtectedLayout } from "./ProtectedLayout";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { ListsPage } from "@/features/lists";

// ── Root route ──────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: RootLayout,
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

// ── Pathless layout routes ──────────────────────────────────────────────────

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "auth",
  component: AuthLayout,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: ProtectedLayout,
});

// ── Leaf routes — auth (under authLayoutRoute) ──────────────────────────────

const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/register",
  component: RegisterPage,
});

const verifyEmailRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/verify-email",
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/reset-password",
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

// ── Leaf routes — app (under appLayoutRoute) ────────────────────────────────

const homeRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: HomePage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/settings",
  component: SettingsPage,
});

const listsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/lists",
  component: ListsPage,
});

// ── Not-found route (child of rootRoute, outside both layouts) ──────────────

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: NotFoundPage,
});

// ── Route tree ──────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([
    loginRoute,
    registerRoute,
    verifyEmailRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
  ]),
  appLayoutRoute.addChildren([
    homeRoute,
    settingsRoute,
    listsRoute,
  ]),
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
