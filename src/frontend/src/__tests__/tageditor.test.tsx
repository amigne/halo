/**
 * Vitest tests for TagEditor — chip rendering, rehydration, serialization,
 * and broken-tag state (étape 5-6).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

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

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18next}>{children}</I18nextProvider>
    </QueryClientProvider>
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
