import { type ComponentType, type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/shared/ui/Modal";
import { useRoutedModal } from "./use-routed-modal";

// ── Registry ─────────────────────────────────────────────────────────────────

interface RegisteredModal {
  component: ComponentType<{ onClose: () => void }>;
  /**
   * i18n key for the modal title.  When omitted the host falls back to
   * `modal.<key>.title` and passes it through `t()` so translations can be
   * provided later without changing the registration call-site.
   */
  titleKey?: string;
}

const modalRegistry = new Map<string, RegisteredModal>();

/**
 * Register a modal component for a given key so that `ModalHost` can render it
 * when the key appears in the URL search params (`?modal=<key>`).
 *
 * Registration is module-level — call it in a module initializer (or a
 * `useEffect` inside a feature layout) before the key is ever opened.
 *
 * @param key       The string that appears in the URL (`?modal=<key>`).
 * @param component The React component to render inside the modal shell.
 *                  Receives `onClose` so the component can programmatically close itself.
 * @param titleKey  Optional i18n key for the modal title. Falls back to `modal.<key>.title`.
 */
export function registerModal(
  key: string,
  component: ComponentType<{ onClose: () => void }>,
  titleKey?: string,
): void {
  modalRegistry.set(key, { component, titleKey });
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
        const registered = modalRegistry.get(key);
        if (!registered) return null;
        const { component: Component, titleKey } = registered;
        const resolvedKey = titleKey ?? `modal.${key}.title`;
        return { key, index, Component, title: t(resolvedKey) };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [modalStack, t]);

  if (modals.length === 0) return null;

  return (
    <>
      {modals.map((m) => {
        const { key, index, Component, title } = m;
        return (
          <Modal
            key={`${key}-${index}`}
            open={true}
            onClose={closeModal}
            title={title}
          >
            <Component onClose={closeModal} />
          </Modal>
        );
      })}
    </>
  );
}
