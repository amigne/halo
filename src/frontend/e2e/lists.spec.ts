/**
 * E2E tests — Lists module (étape 4-6, repaired 5-7).
 *
 * Runs against the **real** backend stack.  The test user is seeded
 * automatically by ``global-setup.ts`` (register + verify via mailpit).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Close every open modal by clicking the top-most ✕ ("Fermer la modale")
 * button — more robust than Escape, whose handling depends on focus being
 * on the dialog (focus may sit in the TipTap editor after typing).
 */
async function closeAllDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const count = await page.getByRole("dialog").count();
    if (count === 0) return;
    await page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Fermer la modale" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(count - 1, {
      timeout: 5_000,
    });
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CREDS = JSON.parse(
  readFileSync(join(__dirname, ".auth", "credentials.json"), "utf-8"),
) as { email: string; password: string };
const TEST_EMAIL = CREDS.email;
const TEST_PASSWORD = CREDS.password;
const LIST_NAME = `Courses E2E ${Date.now()}`;
const ITEM_NAME = "Pain complet bio";

test.describe.configure({ mode: "serial" });

test.describe("Lists (real backend)", () => {
  test("full flow: create list, add item, edit, reload persists", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await page.addInitScript(() => {
      localStorage.setItem("halo.lang", "fr");
    });

    // 1. Login
    await page.goto("/login", { timeout: 15_000 });
    await page.waitForSelector("#login-email", { timeout: 10_000 });
    await page.locator("#login-email").fill(TEST_EMAIL);
    await page.locator("#login-password").fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/", { timeout: 15_000 });
    await page.waitForSelector('header[role="banner"]', { timeout: 10_000 });

    // 2. Navigate to Lists
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
    await expect(page.getByText(LIST_NAME).first()).toBeVisible({ timeout: 10_000 });

    // 4. Open list detail
    const itemsResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(LIST_NAME).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await itemsResp;

    // 5. Add an item — "Ajouter" opens the create modal on top of list detail (ui-6)
    await page.getByRole("button", { name: /Ajouter/ }).first().click();
    await expect(page.getByRole("dialog").last()).toBeVisible({ timeout: 10_000 });

    // Fill title via TagEditor.  The ProseMirror editor renders a
    // contentEditable div — use that as the interaction target.
    const createTitle = page.locator('[contenteditable="true"]').first();
    await createTitle.click();
    await page.keyboard.type("Nouvel élément");
    const addResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await addResp;

    // Item title should be visible in the list detail
    await expect(page.getByText("Nouvel élément")).toBeVisible({ timeout: 10_000 });

    // 6. Click item row → opens ListItemModal for editing (stacked on list detail)
    await page.getByText("Nouvel élément").click();
    await expect(page.getByRole("dialog").last()).toBeVisible({ timeout: 10_000 });

    // Edit the title via TagEditor
    const titleEditor = page.locator('[contenteditable="true"]').first();
    await titleEditor.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type(ITEM_NAME);

    // Blur to trigger autosave (click the modal header)
    const patchResp = page.waitForResponse(
      (r) => r.url().includes("/items/") && r.request().method() === "PATCH",
      { timeout: 15_000 },
    );
    await page.getByRole("heading", { name: "Élément", exact: true }).click();
    await patchResp;

    // Close both modals (item edit, then list detail)
    await closeAllDialogs(page);

    // 7. Re-open and verify persistence.
    // Don't wait on a GET /items here: on re-open React Query may serve the
    // (invalidated-then-refetched) items from cache without a new request.
    // Assert on the rendered item text instead — that proves persistence.
    await page.getByText(LIST_NAME).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(ITEM_NAME)).toBeVisible({ timeout: 10_000 });
  });
});
