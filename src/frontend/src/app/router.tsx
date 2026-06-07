import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { HomePage } from "./routes/home";
import { NotFoundPage } from "./routes/not-found";
import { AppLayout } from "./App";

// ── Root route ──────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: AppLayout,
});

// ── Leaf routes ─────────────────────────────────────────────────────────────

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: NotFoundPage,
});

// ── Route tree ──────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([homeRoute, notFoundRoute]);

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
