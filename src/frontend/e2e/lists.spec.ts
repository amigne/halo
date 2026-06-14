/**
 * E2E tests — Lists module (étape 4-6).
 *
 * Runs against the **real** backend stack.  The test user is seeded
 * automatically by `global-setup.ts` (register + verify via mailpit).
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml --profile postgres up -d
 *   cd src/frontend && npx playwright test
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CREDS = JSON.parse(
  readFileSync(join(__dirname, ".auth", "credentials.json"), "utf-8"),
) as { email: string; password: string };
const TEST_EMAIL = CREDS.email;
const TEST_PASSWORD = CREDS.password;
const LIST_NAME = `Courses E2E ${Date.now()}`;
const ITEM_NAME = "Pain complet bio";

test.describe("Lists (real backend)", () => {
  test("full flow: create list, add item, autosave on blur, reload persists", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // Set French locale
    await page.addInitScript(() => {
      localStorage.setItem("halo.lang", "fr");
    });

    // 1. Login
    await page.goto("/login", { timeout: 15_000 });
    await page.waitForSelector('header[role="banner"]', { timeout: 10_000 });
    await page.locator("#login-email").fill(TEST_EMAIL);
    await page.locator("#login-password").fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 15_000 });
    await page.waitForSelector('header[role="banner"]', { timeout: 10_000 });

    // 2. Navigate to Lists and wait for API
    const listsResp = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.goto("/lists", { timeout: 15_000 });
    await listsResp;

    // 3. Create a list
    await page.getByRole("button", { name: /Créer/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.locator("#list-title").fill(LIST_NAME);
    const createResp = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await createResp;
    // Verify the list card appeared
    await expect(page.getByText(LIST_NAME).first()).toBeVisible({ timeout: 10_000 });

    // 4. Open list via click on card
    // Register response promises BEFORE clicking (requests fire on mount)
    const itemsResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(LIST_NAME).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await itemsResp;
    // Wait for items section to render (empty state or count heading)
    await expect(
      page.locator('h3:has-text("élément")').first(),
    ).toBeVisible({ timeout: 15_000 });

    // 5. Add an item
    // Register response promise BEFORE clicking (POST fires on click)
    const addResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Ajouter/ }).first().click();
    await addResp;
    // The new item is the last "Titre" input (after list title)
    const itemInput = page.getByLabel("Titre").last();
    await expect(itemInput).toBeVisible({ timeout: 10_000 });
    await expect(itemInput).toHaveValue("Nouvel élément");

    // 6. Edit and autosave
    await itemInput.clear();
    await itemInput.fill(ITEM_NAME);
    const patchResp = page.waitForResponse(
      (r) => r.url().includes("/items/") && r.request().method() === "PATCH",
      { timeout: 15_000 },
    );
    await itemInput.blur();
    await patchResp;
    await expect(page.getByText("Enregistré").first()).toBeVisible({
      timeout: 10_000,
    });

    // 7. Reload and verify persistence
    const itemsResp2 = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.reload();
    await page.waitForSelector('header[role="banner"]', { timeout: 10_000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await itemsResp2;
    await expect(page.getByLabel("Titre").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Titre").last()).toHaveValue(ITEM_NAME);
  });
});
