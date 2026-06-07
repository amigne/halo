/**
 * Thin typed fetch wrapper around the generated OpenAPI client (T-136).
 *
 * All response shapes are derived from the backend's live OpenAPI spec
 * via `openapi-typescript` — nothing is hand-coded.
 */

import type { paths } from "./client";

// Chemins générés par openapi-typescript déjà absolus (ex. /api/v1/health).
// En dev le proxy Vite (/api→backend) et en prod le reverse proxy Caddy acheminent /api.
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

export const api = { get: apiGet };
