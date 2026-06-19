/**
 * Frontend module registry — maps backend ``tag_prefix`` values to the
 * frontend modal routes so that clicking a chip can open the correct
 * cross-module detail modal (F-069/F-070, U-084).
 *
 * Each module calls :func:`registerTagModule` at import time (side-effect),
 * same pattern as :func:`~shared/modal/ModalHost.registerModal`.
 */

export interface TagModuleEntry {
  /** Stable module key, matches ``modules.key`` in the backend. */
  key: string;
  /** Uppercase tag prefix (e.g. ``"LIST"``). */
  tag_prefix: string;
  /**
   * Modal key **prefix** for the detail view (e.g. ``"list/"``).
   * When a chip with this prefix is clicked, the routed modal
   * ``<prefix><uuid>`` is opened (e.g. ``list/018f...``).
   */
  detailModalPrefix: string;
}

const _registry: Map<string, TagModuleEntry> = new Map();

/**
 * Register a module's tag→modal mapping.
 *
 * Called once per module at import time.  Raises if *tag_prefix* is
 * already registered (duplicate prefixes are a configuration error).
 */
export function registerTagModule(entry: TagModuleEntry): void {
  if (_registry.has(entry.tag_prefix)) {
    throw new Error(
      `Duplicate tag_prefix "${entry.tag_prefix}": ` +
        `"${_registry.get(entry.tag_prefix)!.key}" already registered`,
    );
  }
  _registry.set(entry.tag_prefix, entry);
}

/** Look up a module entry by tag prefix. */
export function getTagModule(prefix: string): TagModuleEntry | undefined {
  return _registry.get(prefix);
}

/** Return every registered tag module. */
export function listTagModules(): TagModuleEntry[] {
  return [..._registry.values()];
}
