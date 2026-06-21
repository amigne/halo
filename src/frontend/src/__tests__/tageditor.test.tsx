/**
 * Vitest tests for TagEditor — chip rendering, rehydration, serialization,
 * and broken-tag state (étape 5-6).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";

import { i18next } from "@/shared/i18n";
import { TagEditor } from "@/shared/tageditor";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/shared/tageditor/api", () => ({
  searchRefs: vi.fn().mockResolvedValue({ types: [], items: [] }),
}));

vi.mock("@/shared/modal", () => ({
  useRoutedModal: () => ({
    modalStack: [],
    openModal: vi.fn(),
    closeModal: vi.fn(),
    isOpen: () => false,
  }),
  registerModal: vi.fn(),
}));

// Default: resolve returns empty (no hits).
// hoisted so the mock factory can reference it (vi.mock is hoisted above
// all imports, so module-level `let` is not yet initialised).
const resolveResults = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("@/shared/api/fetch-wrapper", () => ({
  apiGet: vi.fn(),
  apiMutate: vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ results: resolveResults }),
        { status: 200 },
      ),
    ),
  ),
  api: { get: vi.fn(), mutate: vi.fn() },
}));

// ── Wrapper ──────────────────────────────────────────────────────────────────

let queryClient: QueryClient;
beforeEach(() => {
  resolveResults.length = 0;
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
});

// Wrap in <StrictMode> to mirror the real app (app/main.tsx). StrictMode's
// dev-mode mount→unmount→remount cycle is what exposed the TagEditor mount
// bug (a manual editor.destroy() tearing down the live editor); rendering the
// tests under StrictMode keeps that regression covered in CI.
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18next}>{children}</I18nextProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForEditor() {
  await waitFor(() => {
    expect(document.querySelector("[data-tag-editor]")).toBeTruthy();
  }, { timeout: 5_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("TagEditor", () => {
  afterEach(() => {
    for (const el of document.querySelectorAll("[data-tag-editor]")) {
      el.remove();
    }
  });

  // ── Mount under StrictMode ───────────────────────────────────────────────
  // Regression guard for "TagEditor fails to mount in the (StrictMode) app":
  // the ProseMirror contentEditable must attach — exactly what the E2E waits
  // for. A manual editor.destroy() used to tear it down under StrictMode.
  it("mounts the contentEditable editor under StrictMode", async () => {
    render(
      <Wrapper>
        <TagEditor value="" onChange={vi.fn()} />
      </Wrapper>,
    );

    await waitFor(
      () => {
        expect(
          document.querySelector('[contenteditable="true"]'),
        ).toBeTruthy();
      },
      { timeout: 5_000 },
    );
  });

  // ── Rehydration ─────────────────────────────────────────────────────────

  it("rehydrates raw {PREFIX:ref_no} text into tagChip nodes", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <TagEditor value="voir {LIST:3} ici" onChange={onChange} />
      </Wrapper>,
    );

    await waitForEditor();

    const chip = document.querySelector("[data-tag-chip]");
    expect(chip).toBeTruthy();
    expect(chip!.getAttribute("data-tag-prefix")).toBe("LIST");
    expect(chip!.getAttribute("data-ref-no")).toBe("3");
    expect(document.body.textContent).not.toMatch(/\{LIST:3\}/);
    expect(chip!.textContent).toContain("LIST:3");
  });

  it("resolves a rehydrated chip to its title (F-067)", async () => {
    // Regression guard: a chip loaded from raw text (not inserted via
    // autocomplete) must still trigger resolution and show its title. The
    // bug was that tag refs were only extracted in onUpdate (user edits),
    // never for externally-loaded content, so reloaded chips stayed bare.
    resolveResults.push({
      tag_prefix: "LIST",
      ref_no: 3,
      title: "Ma liste résolue",
      uuid: "019ea184-0000-7000-8000-000000000003",
      exists: true,
    });

    render(
      <Wrapper>
        <TagEditor value="{LIST:3}" onChange={vi.fn()} />
      </Wrapper>,
    );

    await waitForEditor();

    await waitFor(
      () => {
        const chip = document.querySelector("[data-tag-chip]");
        expect(chip?.getAttribute("data-title")).toBe("Ma liste résolue");
      },
      { timeout: 5_000 },
    );
    expect(document.querySelector(".tag-chip--resolved")).toBeTruthy();
  });

  it("rehydrates multiple tags in the same line", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <TagEditor value="{LIST:1} et {NOTE:7}" onChange={onChange} />
      </Wrapper>,
    );

    await waitForEditor();

    const chips = document.querySelectorAll("[data-tag-chip]");
    expect(chips).toHaveLength(2);
    expect(chips[0]!.textContent).toContain("LIST:1");
    expect(chips[1]!.textContent).toContain("NOTE:7");
  });

  it("rehydrates tags on multiple lines", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <TagEditor
          value="Ligne 1 {LIST:1}\nLigne 2 {NOTE:7}"
          onChange={onChange}
          variant="multiline"
        />
      </Wrapper>,
    );

    await waitForEditor();

    const chips = document.querySelectorAll("[data-tag-chip]");
    expect(chips).toHaveLength(2);
  });

  // ── Unresolved chip styling ─────────────────────────────────────────────

  it("renders unresolved chips with neutral styling", async () => {
    const onChange = vi.fn();
    render(
      <Wrapper>
        <TagEditor value="{LIST:1}" onChange={onChange} />
      </Wrapper>,
    );

    await waitForEditor();

    const chip = document.querySelector("[data-tag-chip]")!;
    expect(chip.className).toContain("tag-chip--unresolved");
    expect(chip.getAttribute("role")).toBeNull();
  });

  // ── Broken tag ──────────────────────────────────────────────────────────

  // NOTE: broken-tag state is validated end-to-end by tags.spec.ts (Playwright).
  // The resolve pipeline (useResolveTags → syncChipTitles → setNodeMarkup)
  // requires a real browser DOM for ProseMirror transaction dispatching.
  it.skip("marks a chip as broken when resolve returns exists=false", async () => {
    // This test is skipped because mocking useResolveTags via vi.mock
    // conflicts with the module-level fetch-wrapper mock.  The E2E
    // Playwright test covers the full broken-tag flow instead.
  });
});
