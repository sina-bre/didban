import { type LoginRequest, loginRequestSchema } from "@didban/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../../shared/lib/api-client";
import { useLocale } from "../../shared/lib/locale-context";
import { safeNext } from "../../shared/lib/return-path";
import { Button, TextField } from "../../shared/ui";
import { AuthFrame } from "./auth-frame";
import { FormError } from "./form-error";
import { useLogin } from "./use-login";

/** `/login` (spec §11): email + password; then the return path, or the forced password change. */
export function LoginPage() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const next = safeNext(useSearchParams()[0].get("next"));
  const login = useLogin();
  const form = useForm<LoginRequest>({ resolver: zodResolver(loginRequestSchema) });
  const { errors } = form.formState;
  const submit = form.handleSubmit((body) =>
    login.mutate(body, {
      onSuccess: ({ user }) => {
        const target = user.mustChangePassword
          ? `/set-password?next=${encodeURIComponent(next)}`
          : next;
        void navigate(target, { replace: true });
      },
    }),
  );
  const failure = login.error instanceof ApiError ? login.error : null;
  const message =
    failure?.status === 401
      ? t("auth.error.invalid")
      : failure?.status === 429
        ? t("auth.error.rateLimited")
        : undefined;
  return (
    <AuthFrame title={t("auth.login.title")} intro={t("auth.login.intro")}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormError error={login.error} message={message} />
        <TextField
          label={t("auth.email")}
          type="email"
          autoComplete="username"
          dir="ltr"
          error={errors.email && t("auth.email.invalid")}
          {...form.register("email")}
        />
        <TextField
          label={t("auth.password")}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          error={errors.password && t("auth.password.required")}
          {...form.register("password")}
        />
        <Button type="submit" variant="primary" disabled={login.isPending}>
          {login.isPending ? t("auth.busy") : t("auth.login.submit")}
        </Button>
      </form>
    </AuthFrame>
  );
}
