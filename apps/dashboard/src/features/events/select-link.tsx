import { Link, useSearchParams } from "react-router";

interface Props {
  /** URL changes: a value sets the parameter, `null` removes it. */
  set: Record<string, string | null>;
  current: boolean;
  label: string;
  /** An event name or property key: kept LTR inside RTL text. */
  code?: boolean;
}

/** A row label that selects it (`?event=`, `?prop=`) in the URL, so back/forward and links keep it. */
export function SelectLink({ set, current, label, code = false }: Props) {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(set)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  return (
    <Link
      to={{ search: `?${next}` }}
      aria-current={current ? "true" : undefined}
      className="inline-flex min-h-11 items-center underline-offset-4 hover:underline aria-[current]:font-semibold"
    >
      <bdi dir={code ? "ltr" : undefined} className="truncate">
        {label}
      </bdi>
    </Link>
  );
}
