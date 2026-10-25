import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "./button";

interface Props {
  /** Caption above the code, e.g. "Script tag". */
  title: string;
  code: string;
  copyLabel: string;
  copiedLabel: string;
  /** Shown when the clipboard is unavailable; the code is then selected for Ctrl+C. */
  failedLabel: string;
}

type State = "idle" | "copied" | "failed";

/**
 * Copy-ready snippet. Code is always LTR, also in `fa`, and wraps instead of scrolling (no hidden
 * text at 360 px). The copy result is announced politely.
 */
export function CodeBlock({ title, code, copyLabel, copiedLabel, failedLabel }: Props) {
  const [state, setState] = useState<State>("idle");
  const pre = useRef<HTMLPreElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      if (pre.current) getSelection()?.selectAllChildren(pre.current);
      setState("failed");
    }
  };
  const status = state === "copied" ? copiedLabel : state === "failed" ? failedLabel : "";
  return (
    <figure className="min-w-0 overflow-hidden rounded-panel border border-line">
      <figcaption className="flex items-center justify-between gap-2 bg-subtle ps-4">
        <span className="text-body font-medium">{title}</span>
        <span className="flex items-center">
          <span aria-live="polite" className="text-caption text-muted">
            {status}
          </span>
          <Button variant="ghost" aria-label={`${copyLabel}: ${title}`} onClick={copy}>
            {state === "copied" ? (
              <Check aria-hidden="true" className="size-4 text-up" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
          </Button>
        </span>
      </figcaption>
      <pre
        ref={pre}
        dir="ltr"
        className="whitespace-pre-wrap break-all p-4 text-caption leading-relaxed"
      >
        <code>{code}</code>
      </pre>
    </figure>
  );
}
