import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Button } from "@/shared/ui/Button";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="mb-2 text-4xl font-bold text-text-muted">404</h2>
      <p className="mb-1 text-xl font-semibold">{t("app.notFound")}</p>
      <p className="mb-6 text-text-muted">{t("app.notFoundHint")}</p>
      <Link to="/">
        <Button variant="primary">{t("app.goHome")}</Button>
      </Link>
    </div>
  );
}
