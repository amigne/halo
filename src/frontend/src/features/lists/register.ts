import { registerModal } from "@/shared/modal";
import { registerTagModule } from "@/modules/registry";
import { CreateListModal } from "./components/CreateListModal";
import { EditListModal } from "./components/EditListModal";
import { ListDetailModal } from "./components/ListDetailModal";
import { ListItemModal } from "./components/ListItemModal";

/**
 * Register all Lists modals and the tag→modal mapping at module init time.
 *
 * Called automatically when this module is imported (side-effect),
 * ensuring modals and tag mappings are registered before ModalHost renders.
 *
 * - `create-list`     → CreateListModal (exact match)
 * - `edit-list/`      → EditListModal (prefix match — `edit-list/<uuid>`)
 * - `list/`           → ListDetailModal (prefix match — `list/<uuid>`)
 * - `list-item/`      → ListItemModal (prefix match — `list-item/<uuid>` or `list-item/new`)
 */
export function registerModals(): void {
  registerModal("create-list", CreateListModal, "lists.createModal.title");
  registerModal("edit-list/", EditListModal, "lists.editModal.title");
  registerModal("list/", ListDetailModal, "lists.detailModal.title");
  registerModal("list-item/", ListItemModal, "lists.itemModal.title");

  // Register tag prefix → modal mapping for cross-module chip clicks.
  registerTagModule({
    key: "lists",
    tag_prefix: "LIST",
    detailModalPrefix: "list/",
  });
}

// Auto-register on import so modals are available when ModalHost renders
registerModals();
