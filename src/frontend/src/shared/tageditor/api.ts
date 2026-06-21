/**
 * API helpers for the tag autocomplete backend (``GET /api/v1/refs/search``).
 *
 * Types are hand-defined until the OpenAPI spec is regenerated with the
 * refs endpoints (step 5-2).
 */

// ── Response types ───────────────────────────────────────────────────────────

export interface PrefixSuggestion {
  prefix: string;
}

export interface SearchResult {
  tag_prefix: string;
  ref_no: number;
  uuid: string;
  title: string;
}

export interface SearchResponse {
  types: PrefixSuggestion[];
  items: SearchResult[];
}

// ── Query ────────────────────────────────────────────────────────────────────

const BASE_URL = "";

/**
 * Call the autocomplete endpoint.
 *
 * Debouncing is handled by the TipTap suggestion extension, not here.
 */
export async function searchRefs(
  q: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const url = `${BASE_URL}/api/v1/refs/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) {
    throw new Error(`refs/search error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<SearchResponse>;
}
