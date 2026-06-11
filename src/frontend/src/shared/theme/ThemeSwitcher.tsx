import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import { type ThemePref, useTheme } from "@/shared/theme/use-theme";

const THEMES: { key: ThemePref; labelKey: string }[] = [
  { key: "light", labelKey: "theme.light" },
  { key: "dark", labelKey: "theme.dark" },
  { key: "system", labelKey: "theme.system" },
];

export function ThemeSwitcher() {
  const { pref, setPref } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1 text-sm">
      {THEMES.map(({ key, labelKey }) => (
        <Button
          key={key}
          variant={pref === key ? "primary" : "ghost"}
          size="sm"
          onClick={() => setPref(key)}
          aria-pressed={pref === key}
        >
          {t(labelKey)}
        </Button>
      ))}
    </div>
  );
}
