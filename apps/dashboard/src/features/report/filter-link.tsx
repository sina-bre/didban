import { Link, useSearchParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { withEquals } from "../../shared/lib/url-filters";

interface Props {
  /** Filter field (`browser`, `prop.plan`, ...). */
  field: string;
  /** The stored value; `null` (not recorded) cannot be filtered on. */
  value: string | null;
  label: string;
}

/** A breakdown row's label that adds `field is value` to the URL's filters. */
export function FilterLink({ field, value, label }: Props) {
  const { t } = useLocale();
  const [params] = useSearchParams();
  if (value === null) return <span className="text-muted">{label}</span>;
  return (
    <Link
      to={{ search: `?${withEquals(params, field, value)}` }}
      aria-label={t("filter.by", { value: label })}
      className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
    >
      <bdi className="truncate">{label}</bdi>
    </Link>
  );
}
