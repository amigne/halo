/**
 * E2E tests — Lists module (étape 4-6).
 *
 * Run:  npx playwright test
 * Requires the Vite dev server (auto-started by webServer config).
 *
 * The backend API is mocked via page.route() so no real backend is needed.
 */

import { expect, test } from "@playwright/test";

// ── Test data ──────────────────────────────────────────────────────────────────

const USER = {
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
};

const LIST_ID = "019ea184-8516-70b4-adc0-3688f19b3d47";
const ITEM_ID = "019ea184-9999-70b4-adc0-3688f19b3d48";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Mock the auth/me endpoint to return an authenticated user. */
async function mockAuth(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, user: USER }),
    });
  });

  // Mock CSRF token endpoint (needed by apiMutate for mutations)
  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "test-csrf-token" }),
      headers: {
        "Set-Cookie":
          "csrf_token=test-csrf-token; Path=/; SameSite=Lax",
      },
    });
  });
}

/** Helper: wait for the app shell to be rendered. */
async function waitForApp(page: import("@playwright/test").Page) {
  await page.waitForSelector('header[role="banner"]', { timeout: 10_000 });
}

// ── Lists page tests ───────────────────────────────────────────────────────────

test.describe("Lists page", () => {
  test("shows empty state when user has no lists", async ({ page }) => {
    // Set French locale for deterministic labels
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    await mockAuth(page);

    // Mock GET /lists → empty array
    await page.route("**/api/v1/modules/lists", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/lists");
    await waitForApp(page);

    // Empty state should be visible
    await expect(
      page.getByText("Aucune liste"),
    ).toBeVisible({ timeout: 5000 });
  });

  test("can create a list and see it in the grid", async ({ page }) => {
    // Set French locale for deterministic labels
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    await mockAuth(page);

    // Track created lists
    const createdLists: Array<Record<string, unknown>> = [];
    // Return lists (initially empty, then with created ones)
    let returnLists: Array<Record<string, unknown>> = [];

    await page.route("**/api/v1/modules/lists", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(returnLists),
        });
      } else if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const newList = {
          id: LIST_ID,
          ref_no: 1,
          owner_context: "personal",
          owner_user_id: USER.id,
          title: body.title,
          icon: body.icon ?? null,
          list_type: body.list_type,
          field_schema: body.field_schema ?? {},
          created_at: "2025-06-12T00:00:00Z",
          updated_at: "2025-06-12T00:00:00Z",
        };
        createdLists.push(body);
        returnLists = [newList];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(newList),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/lists");
    await waitForApp(page);

    // Should see empty state
    await expect(
      page.getByText("Aucune liste"),
    ).toBeVisible({ timeout: 5000 });

    // Click "Créer une liste" button
    await page.getByRole("button", { name: "Créer une liste" }).click();

    // Modal should be visible
    await expect(
      page.getByRole("dialog"),
    ).toBeVisible({ timeout: 5000 });

    // Select "Ideas" type (third radio option)
    const ideasLabel = page.locator("label", { hasText: "Idées" });
    await ideasLabel.click();

    // Fill in title
    const titleInput = page.locator("#list-title");
    await titleInput.fill("Mes idées de projet");

    // Click create button in modal (use exact match to avoid matching "Créer une liste")
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // Modal should close and list should appear
    await expect(
      page.getByText("Mes idées de projet"),
    ).toBeVisible({ timeout: 5000 });

    // Verify the POST body had the right data
    expect(createdLists.length).toBe(1);
    expect(createdLists[0]).toMatchObject({
      title: "Mes idées de projet",
      list_type: "ideas",
    });
  });

  test("can create a custom-type list with advanced fields", async ({ page }) => {
    // Set French locale for deterministic labels
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    await mockAuth(page);

    const returnLists: Array<Record<string, unknown>> = [];

    await page.route("**/api/v1/modules/lists", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(returnLists),
        });
      } else if (route.request().method() === "POST") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const newList = {
          id: LIST_ID,
          ref_no: 1,
          owner_context: "personal",
          owner_user_id: USER.id,
          title: body.title,
          icon: body.icon ?? null,
          list_type: body.list_type,
          field_schema: body.field_schema ?? {},
          created_at: "2025-06-12T00:00:00Z",
          updated_at: "2025-06-12T00:00:00Z",
        };
        returnLists.push(newList);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(newList),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/lists");
    await waitForApp(page);

    // Open create modal
    await page.getByRole("button", { name: "Créer une liste" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Select "Personnalisé" (custom) type
    const customLabel = page.locator("label", { hasText: "Personnalisé" });
    await customLabel.click();

    // Fill title
    await page.locator("#list-title").fill("Projet custom");

    // The advanced fields section should appear — toggle Description checkbox
    const descCheckbox = page
      .locator("label", { hasText: "Description" })
      .locator('input[type="checkbox"]');
    await descCheckbox.check();

    // Submit
    await page.getByRole("button", { name: "Créer", exact: true }).click();

    // Modal should close and list should appear in the grid
    await expect(
      page.getByText("Projet custom"),
    ).toBeVisible({ timeout: 5000 });

    // The type badge should show "Personnalisé"
    await expect(page.getByText("Personnalisé")).toBeVisible({ timeout: 3000 });
  });
});

test.describe("List detail modal", () => {
  test("opens list via routed modal URL and displays items", async ({ page }) => {
    // Set French locale for deterministic labels
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    await mockAuth(page);

    // Mock GET /lists/<id>
    await page.route(`**/api/v1/modules/lists/${LIST_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: LIST_ID,
          ref_no: 1,
          owner_context: "personal",
          owner_user_id: USER.id,
          title: "Ma liste de tâches",
          icon: "star",
          list_type: "tasks",
          field_schema: [
            { key: "title", type: "text", required: true },
            { key: "is_done", type: "checkbox", required: false },
          ],
          created_at: "2025-06-12T00:00:00Z",
          updated_at: "2025-06-12T00:00:00Z",
        }),
      });
    });

    // Mock GET /lists/<id>/items
    await page.route(
      `**/api/v1/modules/lists/${LIST_ID}/items`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: ITEM_ID,
              list_id: LIST_ID,
              title: "Faire les courses",
              description: null,
              is_done: false,
              priority: null,
              due_at: null,
              notify_before: null,
              assignee_user_id: null,
              position: 0,
              created_at: "2025-06-12T00:00:00Z",
              updated_at: "2025-06-12T00:00:00Z",
            },
          ]),
        });
      },
    );

    // Navigate to the lists page with the modal open
    await page.goto(`/lists?modal=list/${LIST_ID}`);
    await waitForApp(page);

    // The modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Modal should show the list title (AutosaveField renders an input with the title)
    await expect(
      page.locator('input[value="Ma liste de tâches"]'),
    ).toBeVisible({ timeout: 5000 });

    // Item should be visible
    await expect(
      page.locator('input[value="Faire les courses"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test("add item to list via modal and see it appear", async ({ page }) => {
    // Set up mocks and locale BEFORE any navigation
    await mockAuth(page);
    await page.addInitScript(() => {
      localStorage.setItem("halo.lang", "fr");
    });

    // Mock main lists endpoint
    await page.route("**/api/v1/modules/lists", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock list detail
    await page.route(`**/api/v1/modules/lists/${LIST_ID}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: LIST_ID,
            ref_no: 1,
            owner_context: "personal",
            owner_user_id: USER.id,
            title: "Courses",
            icon: null,
            list_type: "checklist",
            field_schema: [
              { key: "title", type: "text", required: true },
              { key: "is_done", type: "checkbox", required: false },
            ],
            created_at: "2025-06-12T00:00:00Z",
            updated_at: "2025-06-12T00:00:00Z",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock items — track created items
    const itemsList: Array<Record<string, unknown>> = [];

    await page.route(
      `**/api/v1/modules/lists/${LIST_ID}/items`,
      async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(itemsList),
          });
        } else if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          const item = {
            id: ITEM_ID,
            list_id: LIST_ID,
            title: body.title,
            description: body.description ?? null,
            is_done: body.is_done ?? false,
            priority: body.priority ?? null,
            due_at: body.due_at ?? null,
            notify_before: body.notify_before ?? null,
            assignee_user_id: null,
            position: body.position ?? 0,
            created_at: "2025-06-12T00:00:00Z",
            updated_at: "2025-06-12T00:00:00Z",
          };
          itemsList.push(item);
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify(item),
          });
        } else {
          await route.continue();
        }
      },
    );

    // Navigate to list modal
    await page.goto(`/lists?modal=list/${LIST_ID}`, { timeout: 10000 });
    await waitForApp(page);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Should show empty items state
    await expect(
      page.getByText("Aucun élément"),
    ).toBeVisible({ timeout: 3000 });

    // Click "Ajouter un élément"
    const addButton = page.getByRole("button", { name: "Ajouter un élément" });
    await addButton.first().click();

    // New item should appear with title "Nouvel élément"
    await expect(
      page.locator('input[value="Nouvel élément"]'),
    ).toBeVisible({ timeout: 5000 });
  });

  test("close modal via Escape key", async ({ page }) => {
    // Set French locale for deterministic labels
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    await mockAuth(page);

    // Mock list detail
    await page.route(`**/api/v1/modules/lists/${LIST_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: LIST_ID,
          ref_no: 1,
          owner_context: "personal",
          owner_user_id: USER.id,
          title: "Test",
          icon: null,
          list_type: "checklist",
          field_schema: [],
          created_at: "2025-06-12T00:00:00Z",
          updated_at: "2025-06-12T00:00:00Z",
        }),
      });
    });

    // Mock empty items
    await page.route(
      `**/api/v1/modules/lists/${LIST_ID}/items`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      },
    );

    await page.goto(`/lists?modal=list/${LIST_ID}`);
    await waitForApp(page);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Press Escape to close
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Sidebar navigation", () => {
  test("Lists entry is present in the sidebar menu", async ({ page }) => {
    // Set French locale
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("halo.lang", "fr"));

    await mockAuth(page);

    // Mock GET /lists → empty
    await page.route("**/api/v1/modules/lists", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");
    await waitForApp(page);

    // The sidebar should have a "Listes" link
    const listsLink = page.locator("nav").getByText("Listes");
    await expect(listsLink).toBeVisible({ timeout: 5000 });

    // Click the link
    await listsLink.click();

    // Should navigate to /lists and show the empty state
    await expect(
      page.getByText("Aucune liste"),
    ).toBeVisible({ timeout: 5000 });
  });
});
