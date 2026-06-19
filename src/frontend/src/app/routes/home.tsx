import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/shared/api/fetch-wrapper";
import { Spinner } from "@/shared/ui/Spinner";

export function HomePage() {
  const { t } = useTranslation();

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get("/api/v1/health"),
  });

  const hasData = healthQuery.data != null;

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-4 text-2xl font-semibold">{t("health.title")}</h2>

      <div className="rounded-lg border border-border bg-surface-muted p-6">
        <div className="flex items-center gap-3">
          <span className="text-text-muted">{t("health.status")}:</span>

          {healthQuery.isLoading && (
            <span className="flex items-center gap-2 text-text-muted">
              <Spinner size="sm" />
              {t("health.checking")}
            </span>
          )}

          {healthQuery.isError && (
            <span className="font-medium text-danger">
              {t("health.error")}: {healthQuery.error?.message}
            </span>
          )}

          {hasData && (
            <span className="font-medium text-success">
              {t("health.ok")}
            </span>
          )}
        </div>

        {hasData && (
          <pre className="mt-4 rounded bg-surface p-3 text-sm text-text-muted">
            {JSON.stringify(healthQuery.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
