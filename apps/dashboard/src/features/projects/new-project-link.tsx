import { Plus } from "lucide-react";
import { Link } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";

/** "New project": the onboarding wizard with this organization picked. */
export function NewProjectLink({ organizationId }: { organizationId: string }) {
  const { t } = useLocale();
  return (
    <Link
      to={`/projects/new?org=${encodeURIComponent(organizationId)}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-ink/20 px-4 font-medium hover:bg-subtle"
    >
      <Plus aria-hidden="true" className="size-4" />
      {t("menu.newProject")}
    </Link>
  );
}
