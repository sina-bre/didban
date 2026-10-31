import { KeyRound } from "lucide-react";
import { useLocale } from "../lib/locale-context";
import { CodeBlock } from "../ui";

interface Props {
  title: string;
  secret: string;
}

/**
 * A token or temporary password the server returns once and stores only hashed: copy it now,
 * it cannot be shown again (spec §11, ADR 0024).
 */
export function SecretOnce({ title, secret }: Props) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="flex items-start gap-2 text-body">
        <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("secret.once")}
      </p>
      <CodeBlock
        title={title}
        code={secret}
        copyLabel={t("code.copy")}
        copiedLabel={t("code.copied")}
        failedLabel={t("code.failed")}
      />
    </div>
  );
}
