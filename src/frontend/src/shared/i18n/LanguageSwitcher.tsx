import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";

const LANGS: { code: string; labelKey: string }[] = [
  { code: "fr", labelKey: "language.fr" },
  { code: "en", labelKey: "language.en" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-foreground-muted">{t("language.switchTo")}:</span>
      {LANGS.map(({ code, labelKey }) => (
        <Button
          key={code}
          variant={i18n.language === code ? "primary" : "ghost"}
          size="sm"
          onClick={() => i18n.changeLanguage(code)}
          aria-pressed={i18n.language === code}
        >
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}
