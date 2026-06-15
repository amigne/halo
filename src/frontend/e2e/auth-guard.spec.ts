/**
 * E2E test — garde d'authentification (redirect to /login).
 *
 * Run:  npx playwright test
 * Requires the Vite dev server (auto-started by webServer config).
 */

import { expect, test } from "@playwright/test";

test.describe("Auth guard", () => {
  test("anonymous user visiting /lists is redirected to /login", async ({
    page,
  }) => {
    // Mock /me to return 401 quickly — no backend needed, ensures
    // the auth check fails fast and reliably.
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/lists", { timeout: 15_000 });

    // The auth guard should redirect to /login.
    // Check for the login form's email field as evidence we're on the login page.
    await expect(page.locator("#login-email")).toBeVisible({
      timeout: 10_000,
    });

    // The URL should contain /login (client-side redirect via Navigate).
    await expect(page).toHaveURL(/\/login/);

    // The app shell (topbar with header role="banner") should NOT be visible
    // because /login uses AuthLayout without app chrome.
    await expect(page.locator('header[role="banner"]')).not.toBeVisible({
      timeout: 5_000,
    });
  });

  test("anonymous user visiting / is redirected to /login", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/", { timeout: 15_000 });

    // Should arrive on /login
    await expect(page.locator("#login-email")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test("anonymous user visiting /settings is redirected to /login", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Not authenticated" }),
      });
    });

    await page.goto("/settings", { timeout: 15_000 });

    await expect(page.locator("#login-email")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });
});
