/**
 * E2E tests — tag autocomplete, chip rendering, cross-module click,
 * and broken-tag handling (étape 5-5, repaired 5-7).
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

test.describe.configure({ mode: "serial" });

test.describe("Tags (real backend)", () => {
  test("full flow: autocomplete → chip → click → broken", async ({ page }) => {
    test.setTimeout(240_000);

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

    // 3. Create the TARGET list
    await page.getByRole("button", { name: /Créer/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.locator("#list-title").fill(TARGET_LIST);
    const createTargetResp = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    const targetJson = await (await createTargetResp).json();
    // Close the auto-opened modal
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5_000 });

    // 4. Create the SOURCE list
    const createSourceResp = page.waitForResponse(
      (r) => r.url().endsWith("/modules/lists") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: /Créer/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.locator("#list-title").fill(SOURCE_LIST);
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await (await createSourceResp).json();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5_000 });

    // 5. Open the source list
    const itemsResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(SOURCE_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await itemsResp;

    // 6. Add an item — "Ajouter" opens create modal on top of list detail (ui-6)
    await page.getByRole("button", { name: /Ajouter/ }).first().click();
    await expect(page.getByRole("dialog").last()).toBeVisible({ timeout: 10_000 });

    // Fill the title via TagEditor (target ProseMirror's contentEditable div)
    const createTitle = page.locator('[contenteditable="true"]').first();
    await createTitle.click();
    await page.keyboard.type(ITEM_TITLE);

    // 7. In the description TagEditor, trigger autocomplete with `{L`
    const descEditor = page.locator('[contenteditable="true"]').nth(1);
    await descEditor.click();
    await page.keyboard.type("{L");
    await page.waitForTimeout(500); // debounce + API call

    // The suggestion popover should appear
    const popover = page.locator('[role="listbox"]');
    await expect(popover).toBeVisible({ timeout: 5_000 });
    await expect(popover.locator('[role="option"]').first()).toBeVisible({
      timeout: 3_000,
    });

    // 8. Select the TARGET list from the popover (ArrowDown past "Type")
    await descEditor.press("ArrowDown");
    await descEditor.press("Enter");
    await expect(popover).not.toBeVisible({ timeout: 3_000 });

    // 9. Wait for resolve API call → chip gets title
    const resolveResp = page.waitForResponse(
      (r) => r.url().endsWith("/refs/resolve") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await resolveResp;
    await expect(
      page.locator(".tag-chip--resolved").first(),
    ).toBeVisible({ timeout: 10_000 });

    // 10. Save the item ("Créer" in the create modal)
    const createItemResp = page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Créer", exact: true }).click();
    await createItemResp;
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

    // Close the list detail modal
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5_000 });

    // 11. Re-open the item to check chip persistence + cross-module click
    await page.getByText(SOURCE_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(ITEM_TITLE).first().click();
    // Item edit modal opens stacked on list detail
    await expect(page.getByRole("dialog").last()).toBeVisible({ timeout: 10_000 });

    // Chip resolved (title from resolve)
    await expect(
      page.locator(".tag-chip--resolved").first(),
    ).toBeVisible({ timeout: 10_000 });

    // 12. Click the chip → opens TARGET list modal (stacked on item edit + source detail)
    await page.locator(".tag-chip--resolved").first().click();
    await expect(page.getByRole("dialog").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(TARGET_LIST).first()).toBeVisible({
      timeout: 5_000,
    });

    // 13. Close all modals, then delete the TARGET list from the grid
    await page.keyboard.press("Escape"); // target detail
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); // item edit
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape"); // source detail
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5_000 });

    // Delete from the grid card (two-step: "Modifier la liste" → "Supprimer la liste" → "Oui, supprimer").
    // Navigate from the title button up to the card container (button → row div → card div),
    // then find the menu button within.
    const targetCard = page.getByRole("button", { name: TARGET_LIST })
      .locator("xpath=../..");
    await targetCard.getByRole("button", { name: "Modifier la liste" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Supprimer la liste" }).click();
    const deleteResp = page.waitForResponse(
      (r) => r.url().includes("/modules/lists") && r.request().method() === "DELETE",
      { timeout: 15_000 },
    );
    await page.getByRole("button", { name: "Oui, supprimer" }).click();
    await deleteResp;

    // 14. Re-open source item — chip should be broken
    await page.getByText(SOURCE_LIST).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.waitForResponse(
      (r) => r.url().includes("/items") && r.request().method() === "GET",
      { timeout: 15_000 },
    );
    await page.getByText(ITEM_TITLE).first().click();
    // Item edit modal opens stacked on list detail
    await expect(page.getByRole("dialog").last()).toBeVisible({ timeout: 10_000 });

    // Wait for resolve
    const resolveResp2 = page.waitForResponse(
      (r) => r.url().endsWith("/refs/resolve") && r.request().method() === "POST",
      { timeout: 15_000 },
    );
    await resolveResp2;

    // Chip is now broken
    await expect(
      page.locator(".tag-chip--broken").first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".tag-chip--broken").first()).toContainText(
      "supprimé",
    );
  });
});
