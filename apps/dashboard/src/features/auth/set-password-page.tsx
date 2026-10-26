import { PASSWORD_LIMITS } from "@didban/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldErrors, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../../shared/lib/api-client";
import type { Translate } from "../../shared/lib/i18n";
import { useLocale } from "../../shared/lib/locale-context";
import { safeNext } from "../../shared/lib/return-path";
import { Button, TextField } from "../../shared/ui";
import { AuthFrame } from "./auth-frame";
import { FormError } from "./form-error";
import {
  isPolicyCode,
  lengthCode,
  type SetPasswordForm,
  setPasswordSchema,
} from "./set-password-form";
import { useSetPassword } from "./use-set-password";

const LIMITS = { min: PASSWORD_LIMITS.min, max: PASSWORD_LIMITS.max };

/** Field messages: client checks first, then the server's answer; anything else is generic. */
function messages(t: Translate, errors: FieldErrors<SetPasswordForm>, error: Error | null) {
  const failure = error instanceof ApiError ? error : null;
  const wrong = failure?.status === 401;
  const policy =
    lengthCode(errors.newPassword?.type) ??
    (isPolicyCode(failure?.code) ? failure.code : undefined);
  return {
    current: errors.currentPassword
      ? t("auth.password.required")
      : wrong
        ? t("auth.set.currentWrong")
        : undefined,
    next: policy && t(`auth.set.${policy}`, LIMITS),
    confirm: errors.confirm && t("auth.set.mismatch"),
    unknown: wrong || isPolicyCode(failure?.code) ? null : error,
  };
}

/** `/set-password`: first login after a temporary password (ADR 0024). Nothing else works first. */
export function SetPasswordPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const next = safeNext(useSearchParams()[0].get("next"));
  const save = useSetPassword();
  const form = useForm<SetPasswordForm>({ resolver: zodResolver(setPasswordSchema) });
  const submit = form.handleSubmit(({ currentPassword, newPassword }) =>
    save.mutate(
      { currentPassword, newPassword },
      { onSuccess: () => void navigate(next, { replace: true }) },
    ),
  );
  const shown = messages(t, form.formState.errors, save.error);
  return (
    <AuthFrame title={t("auth.set.title")} intro={t("auth.set.intro")}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormError error={shown.unknown} />
        <TextField
          label={t("auth.set.current")}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          error={shown.current}
          {...form.register("currentPassword")}
        />
        <TextField
          label={t("auth.set.new")}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          hint={t("auth.set.hint", LIMITS)}
          error={shown.next}
          {...form.register("newPassword")}
        />
        <TextField
          label={t("auth.set.confirm")}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          error={shown.confirm}
          {...form.register("confirm")}
        />
        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? t("auth.busy") : t("auth.set.submit")}
        </Button>
      </form>
    </AuthFrame>
  );
}
