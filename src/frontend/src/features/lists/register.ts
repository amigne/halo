import { registerModal } from "@/shared/modal";
import { CreateListModal } from "./components/CreateListModal";
import { ListDetailModal } from "./components/ListDetailModal";

/**
 * Register all Lists modals at module init time.
 *
 * Called automatically when this module is imported (side-effect),
 * ensuring modals are registered before ModalHost renders.
 *
 * - `create-list` → CreateListModal (exact match)
 * - `list/`       → ListDetailModal (prefix match — renders for `list/<uuid>`)
 */
export function registerModals(): void {
  registerModal("create-list", CreateListModal, "lists.createModal.title");
  registerModal("list/", ListDetailModal);
}

// Auto-register on import so modals are available when ModalHost renders
registerModals();
