import { MAX_PREVIEW_PATHS, type RoutePreviewResponse } from "@didban/contracts";
import type { FormEvent } from "react";
import { useLocale } from "../../shared/lib/locale-context";
import { type Column, DataTable, TextAreaField } from "../../shared/ui";
import { failureText } from "../settings/failure-text";
import { FormFooter } from "../settings/form-footer";
import type { useRoutes } from "./use-routes";

type Result = RoutePreviewResponse["results"][number];

/** Try paths against the saved templates before traffic arrives (`POST …/routes/preview`). */
export function RoutePreview({ preview }: { preview: ReturnType<typeof useRoutes>["preview"] }) {
  const { t } = useLocale();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("paths") ?? "");
    const paths = text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, MAX_PREVIEW_PATHS);
    if (paths.length > 0) preview.mutate({ paths });
  };
  const columns: Column<Result>[] = [
    { key: "path", header: t("routes.path"), cell: (r) => <bdi dir="ltr">{r.path}</bdi> },
    {
      key: "template",
      header: t("routes.matched"),
      cell: (r) => (r.template ? <bdi dir="ltr">{r.template}</bdi> : t("routes.asIs")),
    },
  ];
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
        <TextAreaField
          label={t("routes.previewPaths")}
          hint={t("routes.previewHint")}
          name="paths"
          dir="ltr"
          placeholder="/products/42"
        />
        <FormFooter
          error={preview.isError ? failureText(t, preview.error) : undefined}
          pending={preview.isPending}
          label={t("routes.preview")}
        />
      </form>
      {preview.data && (
        <DataTable
          caption={t("routes.previewResult")}
          columns={columns}
          rows={preview.data.results}
          rowKey={(r) => r.path}
        />
      )}
    </div>
  );
}
