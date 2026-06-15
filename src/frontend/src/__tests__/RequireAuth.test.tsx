import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth } from "@/features/auth/RequireAuth";

// ── Mock useAuth ───────────────────────────────────────────────────────────

const authState = {
  data: undefined as { authenticated: boolean } | undefined,
  isLoading: true,
};

vi.mock("@/features/auth/auth-store", () => ({
  useAuth: () => authState,
}));

// ── Mock Navigate ──────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  ),
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("RequireAuth", () => {
  it("shows Spinner while loading", () => {
    authState.isLoading = true;
    authState.data = undefined;

    render(
      <RequireAuth>
        <p data-testid="protected-content">Secret</p>
      </RequireAuth>,
    );

    // Spinner has role="status"
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Protected content should NOT be rendered
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("redirects to /login when not authenticated", () => {
    authState.isLoading = false;
    authState.data = { authenticated: false };

    render(
      <RequireAuth>
        <p data-testid="protected-content">Secret</p>
      </RequireAuth>,
    );

    // Navigate should be rendered with to="/login"
    const redirect = screen.getByTestId("navigate-redirect");
    expect(redirect).toBeInTheDocument();
    expect(redirect.dataset.to).toBe("/login");
    // Protected content should NOT be rendered
    expect(screen.queryByTestId("protected-content")).toBeNull();
  });

  it("redirects to /login when auth data is undefined (network error on /me)", () => {
    authState.isLoading = false;
    authState.data = undefined;

    render(
      <RequireAuth>
        <p data-testid="protected-content">Secret</p>
      </RequireAuth>,
    );

    // !auth?.authenticated covers undefined → redirect
    const redirect = screen.getByTestId("navigate-redirect");
    expect(redirect).toBeInTheDocument();
    expect(redirect.dataset.to).toBe("/login");
  });

  it("renders children when authenticated", () => {
    authState.isLoading = false;
    authState.data = { authenticated: true };

    render(
      <RequireAuth>
        <p data-testid="protected-content">Secret</p>
      </RequireAuth>,
    );

    // Protected content should be rendered
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    // No spinner, no redirect
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByTestId("navigate-redirect")).toBeNull();
  });
});
