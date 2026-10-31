import type { ApiKeyKind } from "@didban/contracts";
import { SecretOnce } from "../../shared/components";
import { useLocale } from "../../shared/lib/locale-context";
import { CodeBlock } from "../../shared/ui";
import { Capabilities } from "./capabilities";
import { snippetsFor } from "./snippets";

interface Props {
  kind: ApiKeyKind;
  token: string;
}

/** A new key with its snippets and what tracking can and cannot see (spec §3.4, §13.4). */
export function IntegrationPanel({ kind, token }: Props) {
  const { t } = useLocale();
  const snippets = snippetsFor(kind, window.location.origin, token);
  return (
    <div className="flex flex-col gap-4">
      <SecretOnce title={t(`keys.kind.${kind}`)} secret={token} />
      <p className="text-body text-muted">
        {kind === "write_browser" ? t("integration.browserIntro") : t("integration.serverIntro")}
      </p>
      {snippets.map((snippet) => (
        <CodeBlock
          key={snippet.id}
          title={t(`integration.${snippet.id}`)}
          code={snippet.code}
          copyLabel={t("code.copy")}
          copiedLabel={t("code.copied")}
          failedLabel={t("code.failed")}
        />
      ))}
      <Capabilities />
    </div>
  );
}
