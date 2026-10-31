import { Rocket } from "lucide-react";
import { useState } from "react";
import { formatNumber } from "../../shared/lib/format";
import { useLocale } from "../../shared/lib/locale-context";
import { Card, CardHeader, Skeleton, Stepper } from "../../shared/ui";
import { NotFoundPage } from "../not-found/page";
import { useAdminOrgs } from "../projects/use-projects";
import { stepOf, type WizardState, WizardStep } from "./wizard-step";

const STEPS = [
  "wizard.step.project",
  "wizard.step.environment",
  "wizard.step.key",
  "wizard.step.check",
] as const;

const START: WizardState = { project: null, environment: null, key: null, checking: false };

/**
 * `/projects/new` (spec §13.4): project → environment → key and snippet → live check, end to end
 * on this page. Org owners/admins only (`org:projects`); for anyone else the page does not exist.
 */
export function OnboardingPage() {
  const { t, locale } = useLocale();
  const orgs = useAdminOrgs();
  const [state, setState] = useState(START);
  if (orgs === undefined) return <Skeleton className="mt-4 h-40" />;
  if (orgs.length === 0) return <NotFoundPage />;
  const step = stepOf(state);
  return (
    <div className="flex flex-col gap-3 py-2 md:gap-4 lg:gap-5">
      <h1 className="text-heading font-semibold">{t("wizard.title")}</h1>
      <Stepper
        label={t("wizard.progress")}
        steps={STEPS.map((s) => t(s))}
        current={step}
        formatNumber={(n) => formatNumber(locale, n)}
      />
      <Card labelledBy="wizard-step">
        <CardHeader
          id="wizard-step"
          icon={Rocket}
          title={t(STEPS[step] ?? "wizard.step.project")}
          subline={state.project?.name}
        />
        <WizardStep
          state={state}
          organizations={orgs}
          onChange={(next) => setState((s) => ({ ...s, ...next }))}
        />
      </Card>
    </div>
  );
}
