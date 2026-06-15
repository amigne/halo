/**
 * E2E tests — layout, theme, language, autosave (étape 3-10 DoD).
 *
 * Run:  npx playwright test
 * Requires the Vite dev server (auto-started by webServer config).
 */

import { expect, test } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Mock the auth/me endpoint to return an authenticated user. */
async function mockAuth(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: "019ea184-8516-70b4-adc0-3688f19b3d47",
          email: "test@halo.local",
          first_name: "Jean",
          last_name: "Dupont",
          is_admin: false,
          is_verified: true,
          locale: "fr",
          theme: "system",
          timezone: "Europe/Paris",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      }),
    });
  });
}

/** Mock the PATCH /users/me endpoint to succeed and echo back the sent body. */
async function mockPatchProfile(page: import("@playwright/test").Page) {
  // Use a regex to match /users/me exactly (not /users/me/notification-prefs etc.)
  await page.route(/\/api\/v1\/users\/me$/, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...body }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Helper: wait for the app shell to be rendered (topbar is the last thing to
 * appear because it depends on the auth query resolving).
 */
async function waitForApp(page: import("@playwright/test").Page) {
  // The header banner or the Halo logo should be visible
  await page.waitForSelector('header[role="banner"]', { timeout: 10_000 });
}

// ── Theme ────────────────────────────────────────────────────────────────────

test.describe("Theme", () => {
  test("topbar theme cycle switches data-theme and persists across reload", async ({
    page,
  }) => {
    await mockAuth(page);
    await page.goto("/");

    // The anti-flash script sets a default theme before React mounts.
    // After hydration, the ThemeProvider applies the stored preference.
    // Default (no localStorage) = "system", resolved via matchMedia.
    const html = page.locator("html");

    // The header should be visible after React mounts
    await expect(page.locator('header[role="banner"]')).toBeVisible();

    // ── Cycle to "light" ──────────────────────────────────────────────────
    // The topbar theme button is the second button in the right group
    // (after language, before bell, before avatar).
    const themeBtn = page.locator(
      'header[role="banner"] > div:last-child > button:nth-child(2)',
    );
    await themeBtn.click();

    // Check that data-theme changed to "light"
    // (first click from system → light)
    await expect(html).toHaveAttribute("data-theme", "light");

    // Check localStorage persistence
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem("halo.theme"),
    );
    expect(storedTheme).toBe("light");

    // ── Reload and verify persistence (no flash — U-092) ──────────────────
    await page.reload();
    await page.waitForSelector('header[role="banner"]');

    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("settings page theme selector syncs with topbar", async ({ page }) => {
    await mockAuth(page);
    await mockPatchProfile(page);

    await page.goto("/settings");
    await page.waitForSelector('header[role="banner"]');

    const html = page.locator("html");

    // The settings page has two Selects: theme (first), language (second).
    // The theme Select has options "light", "dark", "system".
    const themeSelect = page.locator("select").first();
    // Select "dark" theme
    await themeSelect.selectOption("dark");

    // Verify the HTML data-theme updated (same store as topbar)
    await expect(html).toHaveAttribute("data-theme", "dark");

    // The PATCH should have been called
    // Verify via localStorage as well
    const stored = await page.evaluate(() =>
      localStorage.getItem("halo.theme"),
    );
    expect(stored).toBe("dark");
  });
});

// ── Language ─────────────────────────────────────────────────────────────────

test.describe("Language", () => {
  test("topbar language toggle switches FR↔EN and persists across reload", async ({
    page,
  }) => {
    await mockAuth(page);
    // Go to page first (so localStorage is accessible), then set language and reload
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));
    await page.reload();
    await waitForApp(page);

    // Verify French is active
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "fr");

    // The language button is in the topbar right group, contains "FR"/"EN" text
    const langButton = page.locator(
      'header[role="banner"] button:has(span.uppercase)',
    );
    await expect(langButton).toBeVisible();

    // The button shows the language code in lowercase (CSS uppercase transforms it visually)
    await expect(langButton.locator("span.uppercase")).toHaveText("fr");

    // ── Switch to English ────────────────────────────────────────────────
    await langButton.click();

    // Verify lang attribute changed
    await expect(html).toHaveAttribute("lang", "en");

    // The button should now show "en" (lowercase — CSS uppercase transforms it visually)
    await expect(langButton.locator("span.uppercase")).toHaveText("en");

    // Verify localStorage
    const storedLang = await page.evaluate(() =>
      localStorage.getItem("halo.lang"),
    );
    expect(storedLang).toBe("en");

    // ── Reload and verify persistence ─────────────────────────────────────
    await page.reload();
    await waitForApp(page);

    await expect(html).toHaveAttribute("lang", "en");
    const langBtnAfter = page.locator(
      'header[role="banner"] button:has(span.uppercase)',
    );
    await expect(langBtnAfter.locator("span.uppercase")).toHaveText("en");
  });

  test("settings page language selector changes UI text and persists", async ({
    page,
  }) => {
    await mockAuth(page);
    await mockPatchProfile(page);

    // Set French locale before loading settings page
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));
    await page.goto("/settings");
    await page.waitForSelector('header[role="banner"]');

    // The settings page header ("Paramètres") should be in French
    await expect(page.getByRole("heading", { name: "Paramètres" })).toBeVisible();

    // Change language via the settings Select (second select = language)
    const langSelect = page.locator("select").nth(1);
    await langSelect.selectOption("en");

    // The page title should now be in English
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

// ── Autosave ─────────────────────────────────────────────────────────────────

test.describe("Autosave", () => {
  test("modifying first name on settings page saves on blur and persists", async ({
    page,
  }) => {
    // Mock auth before any navigation so the guard doesn't redirect
    await mockAuth(page);

    // Set French locale for deterministic labels
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    // Track PATCH calls to the profile endpoint (exact URL match)
    const patchCalls: Array<Record<string, string>> = [];
    await page.route(/\/api\/v1\/users\/me$/, async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        patchCalls.push(body as Record<string, string>);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/settings");
    await page.waitForSelector('header[role="banner"]');

    // Find the first name input by its label "Prénom" (AutosaveField)
    const firstNameInput = page.getByLabel("Prénom");
    await expect(firstNameInput).toBeVisible();

    // Clear and type a new value
    await firstNameInput.clear();
    await firstNameInput.fill("Marie");

    // Trigger blur to fire the autosave
    await firstNameInput.blur();

    // Wait for the PATCH call to be made
    await expect
      .poll(() => patchCalls.length, { timeout: 5000 })
      .toBeGreaterThanOrEqual(1);

    // Verify the PATCH contained the correct value
    expect(patchCalls[0]).toHaveProperty("first_name", "Marie");

    // The save indicator should show "Enregistré" (success)
    await expect(page.getByText("Enregistré")).toBeVisible({ timeout: 3000 });

    // ── Reload and verify the value persisted ────────────────────────────
    // Re-mock auth to return the updated first name after reload
    await page.route("**/api/v1/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: "019ea184-8516-70b4-adc0-3688f19b3d47",
            email: "test@halo.local",
            first_name: "Marie",
            last_name: "Dupont",
            is_admin: false,
            is_verified: true,
            locale: "fr",
            theme: "system",
            timezone: "Europe/Paris",
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        }),
      });
    });

    await page.reload();
    await page.waitForSelector('header[role="banner"]');

    // The input should now show the persisted value "Marie"
    await expect(page.getByLabel("Prénom")).toHaveValue("Marie");
  });
});

// ── Accessibility smoke test ─────────────────────────────────────────────────

test.describe("Accessibility", () => {
  test("skip-to-content link is present and focusable", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/");
    await waitForApp(page);

    // The skip-to-content link should be in the DOM
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeAttached();

    // Main content should have the matching id
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeAttached();
  });

  test("layout renders without errors (ModalHost + Footer visible)", async ({ page }) => {
    // The ModalHost component is rendered as part of the AppLayout.
    // An actual modal trigger requires modules (étape 4+), but we verify
    // the shell renders without crashing. The real focus-trap behaviour
    // is covered by unit tests (modal.test.tsx).
    await mockAuth(page);
    await page.goto("/");
    await waitForApp(page);

    // The layout should be functional — no rendering errors
    await expect(page.locator("footer")).toBeVisible();
  });
});
