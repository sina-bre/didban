import type { Environment } from "@didban/contracts";
import { useLocale } from "../../shared/lib/locale-context";
import { Button, Tag } from "../../shared/ui";

interface Props {
  environment: Environment;
  onEdit: () => void;
}

/** One environment: name, identity mode, origins (LTR), localhost and IP exclusions. */
export function EnvironmentRow({ environment: env, onEdit }: Props) {
  const { t } = useLocale();
  return (
    <li className="flex flex-wrap items-start gap-3 border-t border-dashed border-line py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <bdi dir="ltr" className="font-medium">
            {env.name}
          </bdi>
          <Tag>{t(`env.identity.${env.identityMode}`)}</Tag>
          {env.trackLocalhost && <Tag>{t("env.localhostOn")}</Tag>}
        </p>
        <p className="text-caption text-muted">
          {env.allowedOrigins.length === 0 ? t("env.noOrigins") : t("env.originsList")}{" "}
          <bdi dir="ltr">{env.allowedOrigins.join(", ")}</bdi>
        </p>
        {env.excludedCidrs.length > 0 && (
          <p className="text-caption text-muted">
            {t("env.cidrsList")} <bdi dir="ltr">{env.excludedCidrs.join(", ")}</bdi>
          </p>
        )}
      </div>
      <Button onClick={onEdit} aria-label={t("env.edit", { name: env.name })}>
        {t("settings.editShort")}
      </Button>
    </li>
  );
}
