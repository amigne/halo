import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import { type Theme, useTheme } from "@/shared/theme/store";

const THEMES: { key: Theme; labelKey: string }[] = [
  { key: "light", labelKey: "theme.light" },
  { key: "dark", labelKey: "theme.dark" },
  { key: "system", labelKey: "theme.system" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 text-sm">
      {THEMES.map(({ key, labelKey }) => (
        <Button
          key={key}
          variant={theme === key ? "primary" : "ghost"}
          size="sm"
          onClick={() => setTheme(key)}
          aria-pressed={theme === key}
        >
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}
