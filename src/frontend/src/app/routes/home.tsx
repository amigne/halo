import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-store";
import { useRoutedModal } from "@/shared/modal";
import { fetchLists } from "@/features/lists/api";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { Badge, type BadgeVariant } from "@/shared/ui/Badge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { SkeletonCard } from "@/shared/ui/Skeleton";
import "@/features/lists/register"; // ensure list modals are registered

const TYPE_VARIANT: Record<string, BadgeVariant> = {
  tasks: "primary",
  checklist: "success",
  ideas: "warning",
  custom: "neutral",
};

export function HomePage() {
  const { t } = useTranslation();
  const { data: auth } = useAuth();
  const { openModal } = useRoutedModal();
  const firstName = auth?.user?.first_name ?? "";

  const {
    data: lists,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lists"],
    queryFn: fetchLists,
  });

  const recentLists = lists?.slice(0, 5) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-semibold text-text">
          {firstName
            ? t("home.welcome", { name: firstName })
            : t("home.welcomeFallback")}
        </h1>
        <p className="mt-1 text-text-muted">{t("home.subtitle")}</p>
      </div>

      {/* Quick access card */}
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-text">{t("home.lists.cta")}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/lists">
            <Button variant="primary">{t("home.lists.cta")}</Button>
          </Link>
          <Button
            variant="secondary"
            onClick={() => openModal("create-list")}
          >
            {t("home.lists.create")}
          </Button>
        </div>
      </Card>

      {/* Lists overview */}
      <div>
        <h2 className="text-lg font-semibold text-text mb-4">
          {t("home.lists.recent")}
        </h2>

        {isLoading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {error && (
          <p className="text-sm text-danger">
            {t("home.error")}
          </p>
        )}

        {!isLoading && !error && recentLists.length === 0 && (
          <EmptyState
            title={t("home.empty.title")}
            action={
              <Button onClick={() => openModal("create-list")}>
                {t("home.empty.cta")}
              </Button>
            }
          />
        )}

        {!isLoading && !error && recentLists.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-text-muted">
              {t("home.lists.count", { count: lists?.length ?? 0 })}
            </p>
            {recentLists.map((list) => (
              <Link
                key={list.id}
                to="/lists"
                search={{ modal: [`list/${list.id}`] }}
                className="block"
              >
                <Card interactive className="flex items-center gap-3 p-3">
                  <span className="flex-1 font-medium text-text truncate">
                    {list.title}
                  </span>
                  <Badge variant={TYPE_VARIANT[list.list_type] ?? "neutral"}>
                    {t(`lists.type.${list.list_type}`)}
                  </Badge>
                  <span className="text-xs text-text-muted">#{list.ref_no}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
