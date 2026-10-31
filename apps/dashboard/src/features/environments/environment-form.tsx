import {
  createEnvironmentRequestSchema,
  type Environment,
  updateEnvironmentRequestSchema,
} from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { TextAreaField, TextField } from "../../shared/ui";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";
import { TrafficFields } from "./traffic-fields";

const FIELDS = {
  identityMode: "text",
  allowedOrigins: "lines",
  excludedCidrs: "lines",
  trackLocalhost: "bool",
} as const;

interface Props {
  /** Edit this one; without it the form creates a new environment. */
  environment?: Environment;
  onSave: (body: never) => Promise<unknown>;
  onDone: () => void;
}

/** Name (new only), identity mode, allowed origins, excluded IP ranges, localhost tracking. */
export function EnvironmentForm({ environment: env, onSave, onDone }: Props) {
  const { t } = useLocale();
  const form = useSettingsForm<unknown>({
    fields: env ? FIELDS : { ...FIELDS, name: "text" },
    schema: env ? updateEnvironmentRequestSchema : createEnvironmentRequestSchema,
    send: onSave as (body: unknown) => Promise<unknown>,
    invalid: (field) => t(field === "name" ? "env.invalid.name" : "settings.invalid"),
    onDone: (el) => {
      if (!env) el.reset();
      onDone();
    },
  });
  const { errors } = form;
  return (
    <form noValidate onSubmit={(e) => void form.onSubmit(e)} className="flex flex-col gap-4">
      {!env && (
        <TextField
          label={t("env.name")}
          hint={t("env.nameHint")}
          name="name"
          dir="ltr"
          defaultValue="production"
          error={errors.name}
        />
      )}
      <TextAreaField
        label={t("env.origins")}
        hint={t("env.originsHint")}
        name="allowedOrigins"
        dir="ltr"
        defaultValue={env?.allowedOrigins.join("\n")}
        error={errors.allowedOrigins}
      />
      <TrafficFields environment={env} errors={errors} />
      <FormFooter
        error={errors.form}
        pending={form.pending}
        label={env ? undefined : t("env.create")}
      />
    </form>
  );
}
