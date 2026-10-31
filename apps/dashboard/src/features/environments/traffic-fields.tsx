import type { Environment } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { SelectField, Switch, TextAreaField } from "../../shared/ui";
import type { FormErrors } from "../settings/use-settings-form";

interface Props {
  environment?: Environment;
  errors: FormErrors;
}

/** Identity mode, excluded IP ranges and localhost: which traffic the environment counts, and how. */
export function TrafficFields({ environment: env, errors }: Props) {
  const { t } = useLocale();
  return (
    <>
      <SelectField
        label={t("env.identity")}
        hint={t("env.identityHint")}
        name="identityMode"
        defaultValue={env?.identityMode ?? "cookieless"}
      >
        <option value="cookieless">{t("env.identity.cookieless")}</option>
        <option value="persistent">{t("env.identity.persistent")}</option>
      </SelectField>
      <TextAreaField
        label={t("env.cidrs")}
        hint={t("env.cidrsHint")}
        name="excludedCidrs"
        dir="ltr"
        defaultValue={env?.excludedCidrs.join("\n")}
        error={errors.excludedCidrs}
      />
      <Switch
        label={t("env.localhost")}
        name="trackLocalhost"
        defaultChecked={env?.trackLocalhost ?? false}
      />
    </>
  );
}
