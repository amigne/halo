import { type ComponentType, type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/shared/ui/Modal";
import { useRoutedModal } from "./use-routed-modal";

// ── Registry ─────────────────────────────────────────────────────────────────

interface RegisteredModal {
  component: ComponentType<{ onClose: () => void; modalKey?: string }>;
  /**
   * i18n key for the modal title.  When omitted the host falls back to
   * `modal.<key>.title` and passes it through `t()` so translations can be
   * provided later without changing the registration call-site.
   */
  titleKey?: string;
}

const modalRegistry = new Map<string, RegisteredModal>();
const prefixRegistry = new Map<string, RegisteredModal>();

/**
 * Register a modal component for a given key so that `ModalHost` can render it
 * when the key appears in the URL search params (`?modal=<key>`).
 *
 * Registration is module-level — call it in a module initializer (or a
 * `useEffect` inside a feature layout) before the key is ever opened.
 *
 * **Prefix matching**: if the key ends with `/` (e.g. `"list/"`), the modal
 * matches any stack key that starts with that prefix (e.g. `"list/<uuid>"`).
 * The component receives the full matched key as `modalKey`.
 *
 * @param key       The string that appears in the URL (`?modal=<key>`).
 *                  If it ends with `/`, prefix-matching is enabled.
 * @param component The React component to render inside the modal shell.
 *                  Receives `onClose` (and `modalKey` for prefix matches).
 * @param titleKey  Optional i18n key for the modal title. Falls back to `modal.<key>.title`.
 */
export function registerModal(
  key: string,
  component: ComponentType<{ onClose: () => void; modalKey?: string }>,
  titleKey?: string,
): void {
  if (key.endsWith("/")) {
    prefixRegistry.set(key, { component, titleKey });
  } else {
    modalRegistry.set(key, { component, titleKey });
  }
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Mount this once at the app root (e.g. `<AppLayout>`).
 *
 * It reads the current `modal` stack from the URL, looks up each key in the
 * registry, and renders the matching component inside an accessible `<Modal>`
 * shell.  When the user closes the topmost modal (Escape / ✕ / overlay click),
 * `closeModal()` removes only the topmost key from the URL.
 */
export function ModalHost(): ReactElement | null {
  const { t } = useTranslation();
  const { modalStack, closeModal } = useRoutedModal();

  const modals = useMemo(() => {
    return modalStack
      .map((key, index) => {
        // Try exact match first, then prefix match
        let registered = modalRegistry.get(key);
        let matchedKey: string | undefined;

        if (!registered) {
          for (const [prefix, reg] of prefixRegistry.entries()) {
            if (key.startsWith(prefix)) {
              registered = reg;
              matchedKey = key;
              break;
            }
          }
        }

        if (!registered) return null;
        const { component: Component, titleKey } = registered;
        const resolvedKey = titleKey ?? `modal.${key}.title`;
        return {
          key,
          index,
          Component,
          title: t(resolvedKey),
          modalKey: matchedKey,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [modalStack, t]);

  if (modals.length === 0) return null;

  return (
    <>
      {modals.map((m) => {
        const { key, index, Component, title, modalKey } = m;
        return (
          <Modal
            key={`${key}-${index}`}
            open={true}
            onClose={closeModal}
            title={title}
          >
            <Component onClose={closeModal} modalKey={modalKey} />
          </Modal>
        );
      })}
    </>
  );
}
