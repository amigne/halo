import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
import { useRoutedModal } from "@/shared/modal/use-routed-modal";
import { fetchLists } from "./api";
import { ListCard } from "./components/ListCard";
import { registerModals } from "./register";

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * ListsPage — main page for the Lists module (U-050).
 *
 * Displays a responsive grid of the user's lists with loading, empty,
 * and error states.  A "Create" button opens the creation modal.
 * Modal registration happens on mount.
 */
export function ListsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openModal } = useRoutedModal();

  // Register modals on mount
  useEffect(() => {
    registerModals();
  }, []);

  // ── Data fetching ────────────────────────────────────────────────────────

  const {
    data: lists,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lists"],
    queryFn: fetchLists,
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreate = () => openModal("create-list");
  const handleOpenList = (id: string) => openModal(`list/${id}`);

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ["lists"] });
  };

  // ── States ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-text">
            {t("lists.error.fetch")}
          </p>
          <p className="text-sm text-text-muted mt-1">
            {error instanceof Error ? error.message : ""}
          </p>
        </div>
        <Button onClick={handleRetry}>{t("lists.error.retry")}</Button>
      </div>
    );
  }

  if (!lists || lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <EmptyState
          icon={
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-muted"
              aria-hidden="true"
            >
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          }
          title={t("lists.empty.title")}
          description={t("lists.empty.description")}
          action={<Button onClick={handleCreate}>{t("lists.create")}</Button>}
        />
      </div>
    );
  }

  // ── Data grid ────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">{t("lists.title")}</h1>
        <Button onClick={handleCreate}>{t("lists.create")}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map((list) => (
          <ListCard
            key={list.id}
            list={list}
            typeLabel={t(`lists.type.${list.list_type}`)}
            onClick={handleOpenList}
          />
        ))}
      </div>
    </div>
  );
}
