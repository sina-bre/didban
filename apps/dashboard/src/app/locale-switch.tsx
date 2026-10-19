import { Languages } from "lucide-react";
import { useLocale } from "../shared/lib/locale-context";
import { Button } from "../shared/ui/button";

/** Two locales in v1 (addendum A4), so the switch toggles to the other one. */
export function LocaleSwitch() {
  const { locale, t, setLocale } = useLocale();
  const other = locale === "fa" ? "en" : "fa";
  return (
    <Button
      aria-label={`${t("locale.switch")}: ${t("locale.other")}`}
      onClick={() => void setLocale(other)}
    >
      <Languages aria-hidden="true" className="size-4" />
      <span lang={other} className="font-system">
        {t("locale.other")}
      </span>
    </Button>
  );
}
