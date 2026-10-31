import type { CreatedApiKey, Environment, Project } from "@didban/contracts";
import { EnvironmentForm } from "../environments/environment-form";
import { useEnvironments } from "../environments/use-environments";
import { LiveCheck } from "../integration/live-check";
import { KeyStep } from "./key-step";
import { ProjectStep } from "./project-step";

export interface WizardState {
  project: Project | null;
  environment: Environment | null;
  key: CreatedApiKey | null;
  checking: boolean;
}

/** 0 project → 1 environment → 2 key and snippet → 3 live check. */
export const stepOf = (s: WizardState): number =>
  !s.project ? 0 : !s.environment ? 1 : !s.checking ? 2 : 3;

interface Props {
  state: WizardState;
  organizations: readonly { id: string; name: string }[];
  onChange: (next: Partial<WizardState>) => void;
}

/** The form of the current step; each one moves the wizard on when it succeeds. */
export function WizardStep({ state, organizations, onChange }: Props) {
  const { project, environment } = state;
  const { create } = useEnvironments(project?.id ?? "");
  if (!project) {
    return (
      <ProjectStep organizations={organizations} onCreated={(p) => onChange({ project: p })} />
    );
  }
  if (!environment) {
    return (
      <EnvironmentForm
        onSave={async (body) => onChange({ environment: await create.mutateAsync(body) })}
        onDone={() => undefined}
      />
    );
  }
  if (!state.checking) {
    return (
      <KeyStep
        projectId={project.id}
        environment={environment}
        created={state.key}
        onCreated={(key) => onChange({ key })}
        onNext={() => onChange({ checking: true })}
      />
    );
  }
  return <LiveCheck projectId={project.id} environment={environment} />;
}
