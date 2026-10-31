import type { ApiKeyKind, Environment } from "@didban/contracts";
import { type FormEvent, useState } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField } from "../../shared/ui";
import { failureText } from "../settings/failure-text";
import { FormFooter } from "../settings/form-footer";

interface Props {
  environments: readonly Environment[];
  pending: boolean;
  onCreate: (input: { environmentId: string; kind: ApiKeyKind }) => Promise<unknown>;
}

/** Environment and key type; the new token then opens in a dialog, once. */
export function CreateKeyForm({ environments, pending, onCreate }: Props) {
  const { t } = useLocale();
  const [error, setError] = useState<string>();
  if (environments.length === 0) {
    return <p className="text-body text-muted">{t("keys.needEnvironment")}</p>;
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await onCreate({
        environmentId: String(data.get("environmentId")),
        kind: String(data.get("kind")) as ApiKeyKind,
      });
      setError(undefined);
    } catch (failure) {
      setError(failureText(t, failure));
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="flex max-w-xl flex-col gap-4">
      <SelectField label={t("keys.environment")} name="environmentId" dir="ltr">
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("keys.kind")} hint={t("keys.kindHint")} name="kind">
        <option value="write_browser">{t("keys.kind.write_browser")}</option>
        <option value="write_server">{t("keys.kind.write_server")}</option>
      </SelectField>
      <FormFooter error={error} pending={pending} label={t("keys.create")} />
    </form>
  );
}
