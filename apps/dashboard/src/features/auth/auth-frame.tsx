import type { ReactNode } from "react";
import { LocaleSwitch } from "../../app/locale-switch";
import { useLocale } from "../../shared/lib/locale-context";
import { Card } from "../../shared/ui";

interface Props {
  title: string;
  intro: string;
  children: ReactNode;
}

/** Centered card for the signed-out pages: wordmark, language switch, one form. */
export function AuthFrame({ title, intro, children }: Props) {
  const { t } = useLocale();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-heading font-semibold">
          <span aria-hidden="true" className="size-2.5 rounded-pill bg-accent" />
          {t("app.name")}
        </span>
        <LocaleSwitch />
      </header>
      <main id="main" className="flex flex-1 flex-col justify-center pb-16">
        <Card labelledBy="auth-title">
          <h1 id="auth-title" className="text-heading font-semibold">
            {title}
          </h1>
          <p className="mt-1 mb-5 text-body text-muted">{intro}</p>
          {children}
        </Card>
      </main>
    </div>
  );
}
