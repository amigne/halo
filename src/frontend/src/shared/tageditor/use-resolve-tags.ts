/**
 * TanStack Query hook for batch-resolving ``{PREFIX:ref_no}`` tags to
 * title + UUID via ``POST /api/v1/refs/resolve`` (T-066/F-062).
 *
 * Cache keyed by ``(context, tag_prefix, ref_no)`` tuples so identical
 * tags in different editor instances share a single API call.
 */

import { useQuery } from "@tanstack/react-query";

import { apiMutate } from "@/shared/api/fetch-wrapper";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ResolveResult {
  tag_prefix: string;
  ref_no: number;
  title: string | null;
  uuid: string | null;
  exists: boolean;
}

interface ResolveResponse {
  results: ResolveResult[];
}

export interface TagRef {
  tag_prefix: string;
  ref_no: number;
}

// ── Query key factory ────────────────────────────────────────────────────────

function resolveKey(refs: TagRef[]): string[] {
  // Stable key: sort so identical sets produce identical keys.
  const sorted = [...refs].sort((a, b) =>
    a.tag_prefix === b.tag_prefix
      ? a.ref_no - b.ref_no
      : a.tag_prefix.localeCompare(b.tag_prefix),
  );
  return [
    "refs",
    "resolve",
    ...sorted.map((r) => `${r.tag_prefix}:${r.ref_no}`),
  ];
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Batch-resolve tag references.
 *
 * Returns a map ``"PREFIX:ref_no" → ResolveResult``.  Tags whose prefix
 * is unknown or whose module is disabled come back as ``exists=false``.
 *
 * The query is **disabled** when *refs* is empty (no API call).
 */
export function useResolveTags(refs: TagRef[]) {
  return useQuery({
    queryKey: resolveKey(refs),
    queryFn: async ({ signal }): Promise<Map<string, ResolveResult>> => {
      if (refs.length === 0) return new Map();

      const res = await apiMutate("/api/v1/refs/resolve", {
        method: "POST",
        body: { refs, context: "personal" },
        signal,
      });

      if (!res.ok) {
        throw new Error(`resolve error ${res.status}`);
      }

      const data: ResolveResponse = await res.json();
      const map = new Map<string, ResolveResult>();
      for (const r of data.results) {
        map.set(`${r.tag_prefix}:${r.ref_no}`, r);
      }
      return map;
    },
    enabled: refs.length > 0,
    staleTime: 30_000,
  });
}
