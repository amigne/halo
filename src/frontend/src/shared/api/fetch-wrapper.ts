/**
 * Thin typed fetch wrapper around the generated OpenAPI client (T-136).
 *
 * All response shapes are derived from the backend's live OpenAPI spec
 * via ``openapi-typescript`` — nothing is hand-coded.
 */

import type { paths } from "./client";

// Generated paths are already absolute (e.g. /api/v1/health).
// In dev the Vite proxy (/api→backend) and in prod the Caddy reverse proxy route /api.
const BASE_URL = "";

type SuccessResponse<
  P extends keyof paths,
  M extends keyof paths[P] & string,
> = paths[P][M] extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : never;

export async function apiGet<P extends keyof paths>(
  path: P,
  options?: { signal?: AbortSignal },
): Promise<SuccessResponse<P, "get">> {
  const response = await fetch(`${BASE_URL}${path as string}`, {
    headers: { Accept: "application/json" },
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

/** Read the (non-HttpOnly) csrf_token cookie set by the backend. */
function readCsrfCookie(): string {
  return document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)?.at(1) ?? "";
}

/**
 * Perform a mutating request (POST/PUT/PATCH/DELETE) with CSRF protection (T-071).
 *
 * Ensures a `csrf_token` cookie exists (fetching `GET /api/v1/auth/csrf` if
 * needed), then sends it back as the `X-CSRF-Token` header. Returns the raw
 * `Response` so callers can inspect `.ok`/`.status` and parse the JSON body.
 */
export async function apiMutate(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<Response> {
  let csrf = readCsrfCookie();
  if (!csrf) {
    await fetch(`${BASE_URL}/api/v1/auth/csrf`, { credentials: "same-origin" });
    csrf = readCsrfCookie();
  }
  return fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
}

export const api = { get: apiGet, mutate: apiMutate };
