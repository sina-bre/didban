import { createRouteTemplateRequestSchema } from "@didban/contracts";
import { Route, SearchCheck } from "lucide-react";
import { useParams } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, StatePanel, TextField } from "../../shared/ui";
import { QueryBlock } from "../report/query-block";
import { FormFooter } from "../settings/form-footer";
import { useSettingsForm } from "../settings/use-settings-form";
import { RoutePreview } from "./route-preview";
import { RoutesTable } from "./routes-table";
import { useRoutes } from "./use-routes";

/** Route templates (`/products/:id`): group dynamic paths so reports stay readable (spec §7). */
export function RoutesPage() {
  const { t } = useLocale();
  const projectId = useParams().projectId ?? "";
  const { list, create, move, remove, preview } = useRoutes(projectId);
  const form = useSettingsForm({
    fields: { pattern: "text" },
    schema: createRouteTemplateRequestSchema,
    send: (body) => create.mutateAsync(body.pattern),
    invalid: () => t("routes.invalid"),
    onDone: (el) => el.reset(),
  });
  return (
    <>
      <Card labelledBy="routes-title">
        <CardHeader id="routes-title" icon={Route} title={t("settings.routes")} />
        <p className="mb-4 max-w-prose text-body text-muted">{t("routes.intro")}</p>
        <QueryBlock query={list} skeleton="h-40">
          {(data) =>
            data.routes.length === 0 ? (
              <StatePanel
                icon={Route}
                title={t("routes.none.title")}
                body={t("routes.none.body")}
              />
            ) : (
              <RoutesTable
                routes={data.routes}
                onMove={(route, position) => move.mutate({ id: route.id, body: { position } })}
                onDelete={(route) => remove.mutateAsync(route.id)}
              />
            )
          }
        </QueryBlock>
        <form
          noValidate
          onSubmit={(e) => void form.onSubmit(e)}
          className="mt-4 flex max-w-xl flex-col gap-4"
        >
          <TextField
            label={t("routes.pattern")}
            hint={t("routes.patternHint")}
            name="pattern"
            dir="ltr"
            required
            error={form.errors.pattern}
          />
          <FormFooter error={form.errors.form} pending={form.pending} label={t("routes.add")} />
        </form>
      </Card>
      <Card labelledBy="preview-title">
        <CardHeader id="preview-title" icon={SearchCheck} title={t("routes.preview")} />
        <RoutePreview preview={preview} />
      </Card>
    </>
  );
}
