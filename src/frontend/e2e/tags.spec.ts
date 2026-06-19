/**
 * E2E tests — tag autocomplete, chip rendering, cross-module click,
 * and broken-tag handling (étape 5-5).
 *
 * Runs against the **real** backend stack.  The test user is seeded
 * automatically by ``global-setup.ts`` (register + verify via mailpit).
 *
 * Prerequisites:
 *   docker compose -f docker-compose.dev.yml --profile postgres up -d
 *   cd src/frontend && npx playwright test e2e/tags.spec.ts
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

const TARGET_LIST = `Liste cible ${Date.now()}`;
const SOURCE_LIST = `Liste source ${Date.now()}`;
const ITEM_TITLE = "Élément avec balise";

test.describe("Tags (real backend)", () => {
  test("full flow: autocomplete → chip → click → broken", async ({ page }) => {
    test.setTimeout(240_000);

    // ── Setup ──────────────────────────────────────────────────────────────
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

    // 2. Go to Lists
    const listsResp1 = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.goto("/lists", { timeout: 15_000 });
    await listsResp1;

    // 3. Create the TARGET list (will be referenced by the chip)
    await page.getByRole("button", { name: /Créer/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.locator("#list-title").fill(TARGET_LIST);
    const createTargetResp = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    const targetJson = await (await createTargetResp).json();
    const targetRefNo: number = targetJson.ref_no;
    const targetId: string = targetJson.id;
    // Close the auto-opened modal
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });

    // 4. Create the SOURCE list (will contain an item with a tag to TARGET)
    const createSourceResp = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Créer/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.locator("#list-title").fill(SOURCE_LIST);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    const sourceJson = await (await createSourceResp).json();
    const sourceId: string = sourceJson.id;
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });

    // 5. Open the source list
    const itemsResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(SOURCE_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await itemsResp;

    // 6. Add an item via the "Ajouter" button
    await page.getByRole("button", { name: /Ajouter/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    // Fill the title
    await page
      .locator("[data-tag-editor]")
      .first()
      .fill(ITEM_TITLE);

    // 7. In the description TagEditor, type `{LIS` to trigger autocomplete
    const descEditor = page.locator("[data-tag-editor]").nth(1);
    await descEditor.click();
    // TipTap uses contentEditable — use type() which sends keystrokes.
    await descEditor.press("{");
    await page.waitForTimeout(200); // debounce + API call
    await descEditor.press("L");
    await page.waitForTimeout(300);

    // The suggestion popover should be visible with the LIST type and matching objects
    const popover = page.locator('[role="listbox"]');
    await expect(popover).toBeVisible({ timeout: 5_000 });

    // Verify the LIST type entry is shown
    await expect(popover.locator('[role="option"]').first()).toBeVisible({
      timeout: 3_000,
    });

    // 8. Select the first item (the TARGET list) by pressing Enter
    // First press ArrowDown to skip the "Type LIST" entry, then Enter on the object
    await descEditor.press("ArrowDown");
    await descEditor.press("Enter");

    // The popover should close
    await expect(popover).not.toBeVisible({ timeout: 3_000 });

    // 9. Verify the raw tag {LIST:N} was inserted
    // Wait for the resolve API call
    const resolveResp = page.waitForResponse(
      (r) => r.url().endsWith("/refs/resolve") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await resolveResp;

    // The chip should now show the resolved title
    await expect(
      page.locator(".tag-chip--resolved").first(),
    ).toBeVisible({ timeout: 10_000 });

    // 10. Save the item
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 }); // back to list detail

    // Close list detail
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });

    // 11. Re-open the item to check persistence
    await page.getByText(SOURCE_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    // Click on the item row
    await page.getByText(ITEM_TITLE).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    // The chip should still be there (resolved)
    await expect(
      page.locator(".tag-chip--resolved").first(),
    ).toBeVisible({ timeout: 10_000 });

    // 12. Click the chip → should open the TARGET list modal (cross-module)
    await page.locator(".tag-chip--resolved").first().click();
    // Wait for the target list detail modal
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    // The modal should show the target list's title
    await expect(page.getByText(TARGET_LIST).first()).toBeVisible({
      timeout: 5_000,
    });

    // 13. Close both modals, then delete the target list
    await page.keyboard.press("Escape"); // close target list detail
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); // close item edit
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); // close source list detail
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5_000 });

    // Delete the target list
    // Open the target list, then edit → delete
    await page.getByText(TARGET_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    // Click "..." menu button (EditListModal opener)
    await page.locator('button[aria-label*="Options"]').first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    // Click delete
    const deleteResp = page.waitForResponse(
      (r) =>
        r.url().includes("/modules/lists") &&
        r.request().method() === "DELETE",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Supprimer/ }).click();
    await deleteResp;

    // 14. Re-open the source list item — the chip should now be broken
    await page.getByText(SOURCE_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(ITEM_TITLE).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    // Wait for resolve
    const resolveResp2 = page.waitForResponse(
      (r) => r.url().endsWith("/refs/resolve") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await resolveResp2;

    // The chip should now be broken (exists=false → "__broken__")
    await expect(
      page.locator(".tag-chip--broken").first(),
    ).toBeVisible({ timeout: 10_000 });
    // It should display "(supprimé)"
    await expect(page.locator(".tag-chip--broken").first()).toContainText(
      "supprimé",
    );
  });
});
