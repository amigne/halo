import { registerModal } from "@/shared/modal";
import { CreateListModal } from "./components/CreateListModal";
import { ListDetailModal } from "./components/ListDetailModal";
import { ListItemModal } from "./components/ListItemModal";

/**
 * Register all Lists modals at module init time.
 *
 * Called automatically when this module is imported (side-effect),
 * ensuring modals are registered before ModalHost renders.
 *
 * - `create-list`     → CreateListModal (exact match)
 * - `list/`           → ListDetailModal (prefix match — renders for `list/<uuid>`)
 * - `list-item/`      → ListItemModal (prefix match — `list-item/<uuid>` or `list-item/new`)
 */
export function registerModals(): void {
  registerModal("create-list", CreateListModal, "lists.createModal.title");
  registerModal("list/", ListDetailModal, "lists.detailModal.title");
  registerModal("list-item/", ListItemModal, "lists.itemModal.title");
}

// Auto-register on import so modals are available when ModalHost renders
registerModals();
