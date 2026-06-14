/**
 * Typed API client for the Lists module (F-111..F-115).
 *
 * Uses `apiMutate` for mutations (CSRF-protected) and a thin GET helper
 * for reads. Types are derived from the generated OpenAPI client.
 */

import type { components } from "@/shared/api/client";
import { apiMutate } from "@/shared/api/fetch-wrapper";

// ── Type aliases from the generated OpenAPI schema ─────────────────────────────

export type ListResponse = components["schemas"]["ListResponse"];
export type ListCreate = components["schemas"]["ListCreate"];
export type ListUpdate = components["schemas"]["ListUpdate"];

export type ListItemResponse = components["schemas"]["ListItemResponse"];
export type ListItemCreate = components["schemas"]["ListItemCreate"];
export type ListItemUpdate = components["schemas"]["ListItemUpdate"];

// ── Helpers ────────────────────────────────────────────────────────────────────

const BASE = ""; // Vite proxy handles /api in dev, Caddy in prod

/** Thin GET helper — returns parsed JSON. Sends session cookie for auth. */
async function apiGet(path: string): Promise<unknown> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!resp.ok) {
    throw new Error(await extractError(resp));
  }
  return resp.json();
}

/** Extract a human-readable error message from a failed Response. */
async function extractError(resp: Response): Promise<string> {
  try {
    const body = (await resp.json()) as { detail?: { message?: string }; message?: string };
    return body.detail?.message ?? body.message ?? `HTTP ${resp.status}`;
  } catch {
    return `HTTP ${resp.status}`;
  }
}

/** Mutate helper with CSRF — calls apiMutate, checks ok, parses JSON on success. */
async function apiMutateJson<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const resp = await apiMutate(path, options);
  if (!resp.ok) throw new Error(await extractError(resp));
  if (resp.status === 204) return undefined as T; // No Content
  return resp.json() as Promise<T>;
}

// ── Lists CRUD ─────────────────────────────────────────────────────────────────

const LISTS_PATH = "/api/v1/modules/lists";

/** Fetch all lists owned by the current user. */
export async function fetchLists(): Promise<ListResponse[]> {
  return apiGet(LISTS_PATH) as Promise<ListResponse[]>;
}

/** Create a new list. Returns the created list on success. */
export async function createList(data: ListCreate): Promise<ListResponse> {
  return apiMutateJson<ListResponse>(LISTS_PATH, { method: "POST", body: data });
}

/** Fetch a single list by its UUID. */
export async function fetchList(id: string): Promise<ListResponse> {
  return apiGet(`${LISTS_PATH}/${id}`) as Promise<ListResponse>;
}

/** Partially update a list (title, icon, field_schema). */
export async function updateList(
  id: string,
  data: ListUpdate,
): Promise<ListResponse> {
  return apiMutateJson<ListResponse>(`${LISTS_PATH}/${id}`, {
    method: "PATCH",
    body: data,
  });
}

/** Delete a list and all its items (cascade). */
export async function deleteList(id: string): Promise<void> {
  await apiMutateJson<void>(`${LISTS_PATH}/${id}`, { method: "DELETE" });
}

// ── Items CRUD ─────────────────────────────────────────────────────────────────

function itemsPath(listId: string): string {
  return `${LISTS_PATH}/${listId}/items`;
}

function itemPath(listId: string, itemId: string): string {
  return `${itemsPath(listId)}/${itemId}`;
}

/** Fetch all items for a list, ordered by position. */
export async function fetchItems(listId: string): Promise<ListItemResponse[]> {
  return apiGet(itemsPath(listId)) as Promise<ListItemResponse[]>;
}

/** Create a new item in a list. */
export async function createItem(
  listId: string,
  data: ListItemCreate,
): Promise<ListItemResponse> {
  return apiMutateJson<ListItemResponse>(itemsPath(listId), {
    method: "POST",
    body: data,
  });
}

/** Partially update an item. */
export async function updateItem(
  listId: string,
  itemId: string,
  data: ListItemUpdate,
): Promise<ListItemResponse> {
  return apiMutateJson<ListItemResponse>(itemPath(listId, itemId), {
    method: "PATCH",
    body: data,
  });
}

/** Delete an item from a list. */
export async function deleteItem(
  listId: string,
  itemId: string,
): Promise<void> {
  await apiMutateJson<void>(itemPath(listId, itemId), { method: "DELETE" });
}
