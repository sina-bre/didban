import { Outlet } from "react-router";
import { useLocale } from "../shared/lib/locale-context";
import { MobileTabs } from "./mobile-tabs";
import { TopBar } from "./top-bar";

/** One responsive shell: top bar everywhere, pill nav from `lg`, bottom tab bar below it. */
export function AppShell() {
  const { t } = useLocale();
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-20 focus:rounded-control focus:bg-surface focus:p-3"
      >
        {t("app.skip")}
      </a>
      <TopBar />
      <main
        id="main"
        className="mx-auto max-w-content px-4 pt-2 pb-28 md:px-5 lg:px-6 lg:pb-10"
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <MobileTabs />
    </div>
  );
}
