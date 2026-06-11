import { useCallback, useMemo, useRef } from "react";
import { useRouter, useSearch } from "@tanstack/react-router";

/**
 * Routed modal hook — modal state lives in the URL via `?modal=<key>` (U-054).
 *
 * Multiple modals are stacked in the URL: `?modal=a&modal=b`.
 * Escape / close button removes only the **topmost** modal.
 *
 * Usage:
 * ```ts
 * const { modalStack, openModal, closeModal, isOpen } = useRoutedModal()
 * openModal("settings")
 * ```
 */
export function useRoutedModal() {
  const search = useSearch({ strict: false }) as { modal?: string[] };
  const router = useRouter();

  // Memoize to avoid new array references on every render (react-hooks/exhaustive-deps).
  const modalStack: string[] = useMemo(
    () => search.modal ?? [],
    [search.modal],
  );

  // Keep a ref to the latest modalStack so the callbacks below are stable
  // (they don't need to list modalStack in their deps).
  const stackRef = useRef(modalStack);
  stackRef.current = modalStack;

  const openModal = useCallback(
    (key: string) => {
      const currentSearch = (router.latestLocation.search ??
        {}) as Record<string, unknown>;
      const stack = stackRef.current;
      router.navigate({
        search: {
          ...currentSearch,
          modal: [...stack, key],
        },
        replace: false,
      } as never);
    },
    [router],
  );

  const closeModal = useCallback(() => {
    const currentSearch = (router.latestLocation.search ??
      {}) as Record<string, unknown>;
    const stack = stackRef.current;
    if (stack.length === 0) return;
    const next = stack.slice(0, -1);
    const newSearch: Record<string, unknown> = { ...currentSearch };
    if (next.length === 0) {
      delete newSearch.modal;
    } else {
      newSearch.modal = next;
    }
    router.navigate({
      search: newSearch,
      replace: false,
    } as never);
  }, [router]);

  const isOpen = useCallback(
    (key: string) => modalStack.includes(key),
    [modalStack],
  );

  return { modalStack, openModal, closeModal, isOpen } as const;
}
