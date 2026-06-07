import { describe, expect, it, vi, afterEach } from "vitest";
import { apiGet } from "@/shared/api/fetch-wrapper";

describe("fetch-wrapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the exact path without double-prefixing /api/v1", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await apiGet("/api/v1/health");

    // Must call exactly /api/v1/health, NOT /api/v1/api/v1/health
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const firstCall = mockFetch.mock.calls[0]!;
    const url = firstCall[0] as string;
    expect(url).toBe("/api/v1/health");
    expect(url).not.toContain("/api/v1/api/v1");
  });

  it("throws on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 500, statusText: "Internal Server Error" }),
    );
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiGet("/api/v1/health")).rejects.toThrow(
      "API error 500: Internal Server Error",
    );
  });

  it("passes AbortSignal when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const controller = new AbortController();
    await apiGet("/api/v1/health", { signal: controller.signal });

    const firstCall = mockFetch.mock.calls[0]!;
    const init = firstCall[1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });
});
