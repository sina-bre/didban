import type { MessageKey } from "../../shared/lib/i18n";
import { useLocale } from "../../shared/lib/locale-context";
import { PillNav } from "../../shared/ui";

interface Props {
  label: string;
  /** Path prefix of the tabs, e.g. `/projects/<id>/settings`. */
  base: string;
  tabs: readonly { id: string; label: MessageKey }[];
}

/** Settings sub-pages as pills (same look as the report nav), scrollable at 360 px. */
export function SettingsNav({ label, base, tabs }: Props) {
  const { t } = useLocale();
  return (
    <PillNav
      label={label}
      items={tabs.map((tab) => ({ to: `${base}/${tab.id}`, label: t(tab.label) }))}
    />
  );
}
