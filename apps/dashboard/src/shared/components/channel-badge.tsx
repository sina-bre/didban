import { useLocale } from "../lib/locale-context";

/** `channel` codes from `@didban/contracts` CHANNELS (append-only, spec §4). */
export type ChannelCode = 0 | 1 | 2 | 3 | 4 | 5;

const MARKER: Record<ChannelCode, string> = {
  0: "bg-series-2",
  1: "bg-series-1",
  2: "bg-accent-text",
  3: "bg-series-3",
  4: "bg-navy-700",
  5: "bg-muted",
};

/** Channel name with its 3 px category marker ("| Organic search", design system §1). */
export function ChannelBadge({ code }: { code: ChannelCode }) {
  const { t } = useLocale();
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`h-4 w-0.75 shrink-0 rounded-pill ${MARKER[code]}`} />
      {t(`channel.${code}`)}
    </span>
  );
}
