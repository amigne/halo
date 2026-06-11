import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "./EmptyState";

export interface TableColumn<T> {
  /** Unique key for this column. */
  key: string;
  /** Header text. */
  header: string;
  /** Custom cell renderer. When omitted, renders `String(item[key])`. */
  render?: (item: T) => ReactNode;
  /** Whether this column is sortable. */
  sortable?: boolean;
}

interface TableProps<T> {
  /** Column definitions. */
  columns: TableColumn<T>[];
  /** Row data. */
  data: T[];
  /** Optional accessible caption. */
  caption?: string;
  /** Custom empty state node, rendered when data is empty. */
  emptyState?: ReactNode;
}

/**
 * Semantic data table consuming design tokens.
 *
 * - Uses `<table>`, `<thead>`, `<th scope="col">`, `<tbody>` for screen readers
 * - Empty state via `EmptyState` or custom `emptyState` prop
 * - Styled with design tokens only
 */
export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  caption,
  emptyState,
}: TableProps<T>) {
  const { t } = useTranslation();

  if (data.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <EmptyState
        title={t("ui.table.noData")}
        description={t("ui.emptyState.defaultDescription")}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        {caption && (
          <caption className="sr-only">{caption}</caption>
        )}
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="px-4 py-3 text-left font-semibold text-text"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="border-b border-border last:border-b-0 hover:bg-surface"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-text">
                  {col.render
                    ? col.render(row)
                    : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
