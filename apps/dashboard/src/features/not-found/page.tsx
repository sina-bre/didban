import { useLocale } from "../../shared/lib/locale-context";

/** Missing and forbidden routes look the same (spec §13.3). */
export function NotFoundPage() {
  const { t } = useLocale();
  return (
    <section className="rounded-card-sm bg-surface p-6 shadow-card md:rounded-card">
      <h1 className="text-heading font-semibold">{t("notFound.title")}</h1>
      <p className="mt-1 text-muted">{t("notFound.body")}</p>
    </section>
  );
}
