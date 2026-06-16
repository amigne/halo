import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

/**
 * Footer — spec §1 (U-002).
 *
 * Displays MIT license copyright and a Privacy link placeholder.
 * Real Privacy content arrives in step 8.
 */
export function Footer() {
  const { t } = useTranslation();

  return (
    <footer
      className="border-t border-border bg-surface px-4 py-1 text-center text-xs text-text-muted"
      role="contentinfo"
    >
      <span>{t("layout.footer.copyright")}</span>
      {" · "}
      <Link
        to={t("layout.footer.privacyUrl")}
        className="underline underline-offset-2 hover:text-text focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none rounded-sm"
      >
        {t("layout.footer.privacy")}
      </Link>
    </footer>
  );
}
