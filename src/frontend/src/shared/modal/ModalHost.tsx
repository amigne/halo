import { type ComponentType, type ReactNode, useMemo } from "react";
import { Modal } from "@/shared/ui/Modal";
import { useRoutedModal } from "./use-routed-modal";

// ── Registry ─────────────────────────────────────────────────────────────────

interface RegisteredModal {
  component: ComponentType<{ onClose: () => void }>;
  /** i18n key for the title, or a literal string. Defaults to `modal.{key}.title`. */
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
 * @param titleKey  Optional i18n key for the modal title. Falls back to `modal.{key}.title`.
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
export function ModalHost(): ReactNode {
  const { modalStack, closeModal } = useRoutedModal();

  const modals = useMemo(() => {
    return modalStack
      .map((key, index) => {
        const registered = modalRegistry.get(key);
        if (!registered) return null;
        const { component: Component, titleKey } = registered;
        return { key, index, Component, titleKey };
      })
      .filter(Boolean);
  }, [modalStack]);

  if (modals.length === 0) return null;

  return modals.map((m) => {
    if (!m) return null;
    const { key, index, Component, titleKey } = m;
    const title = titleKey ?? `modal.${key}.title`;

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
  });
}
