import { Outlet } from "react-router";
import { useLocale } from "../../shared/lib/locale-context";
import { Skeleton } from "../../shared/ui";
import { useMe } from "../auth/use-me";
import { NotFoundPage } from "../not-found/page";
import { SettingsNav } from "../settings/settings-nav";

const TABS = [
  { id: "organizations", label: "admin.organizations" },
  { id: "users", label: "admin.users" },
  { id: "instance", label: "admin.instance" },
] as const;

/** `/admin/*` for platform admins; the UI only hides it, the API enforces it (spec §13.3). */
export function AdminLayout() {
  const { t } = useLocale();
  const me = useMe();
  if (me.isPending) return <Skeleton className="mt-4 h-40" />;
  if (!me.data?.user.isPlatformAdmin) return <NotFoundPage />;
  return (
    <div className="flex flex-col gap-3 md:gap-4 lg:gap-5">
      <header className="flex flex-col gap-3 py-2">
        <h1 className="text-heading font-semibold">{t("admin.title")}</h1>
        <SettingsNav label={t("settings.nav")} base="/admin" tabs={TABS} />
      </header>
      <Outlet />
    </div>
  );
}
