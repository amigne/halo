import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

export interface TabItem {
  /** Unique tab identifier. */
  id: string;
  /** Visible label text. */
  label: string;
  /** Content rendered when this tab is active. */
  content: ReactNode;
}

interface TabsProps {
  /** Tab definitions. */
  tabs: TabItem[];
  /** ID of the initially selected tab. Defaults to the first tab. */
  defaultTab?: string;
  /** Called when the active tab changes. */
  onChange?: (tabId: string) => void;
}

/**
 * Accessible tabs following the ARIA tablist/tab/tabpanel pattern.
 *
 * - Arrow key navigation (← →) between tabs
 * - `aria-selected`, `aria-controls`, `tabIndex`, `role="tablist"`
 * - Active indicator uses `--color-primary` token
 * - Focus ring uses `--color-focus-ring`
 */
export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const { t } = useTranslation();
  const baseId = useId();
  const [activeTab, setActiveTab] = useState<string>(
    defaultTab ?? tabs[0]?.id ?? "",
  );

  const tabRefs = useMemo(() => new Map<string, HTMLButtonElement>(), []);

  const selectTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      onChange?.(tabId);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
      let nextIdx: number | null = null;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextIdx = (currentIdx + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        nextIdx = tabs.length - 1;
      }

      if (nextIdx !== null) {
        const nextTab = tabs[nextIdx]!;
        selectTab(nextTab.id);
        tabRefs.get(nextTab.id)?.focus();
      }
    },
    [tabs, selectTab, tabRefs],
  );

  if (tabs.length === 0) return null;

  const activeContent = tabs.find((t) => t.id === activeTab);

  return (
    <div>
      <div role="tablist" aria-label={t("ui.tabs.tab")} className="flex border-b border-border">
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === activeTab;
          const panelId = `${baseId}-panel-${tab.id}`;
          const tabId = `${baseId}-tab-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.set(tab.id, el);
                else tabRefs.delete(tab.id);
              }}
              id={tabId}
              role="tab"
              type="button"
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`relative px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none cursor-pointer ${
                isSelected
                  ? "text-primary"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
              {isSelected && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      {activeContent && (
        <div
          id={`${baseId}-panel-${activeContent.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeContent.id}`}
          tabIndex={0}
          className="py-4"
        >
          {activeContent.content}
        </div>
      )}
    </div>
  );
}
