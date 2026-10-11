import { SetupWizardNavigation } from "../SetupWizard";

export function ChatSetupNavigation(props: {
  labels?: string[]; step: number; availableStep: number; disabled?: boolean; onSelect: (step: number) => void;
}) {
  return <SetupWizardNavigation {...props} labels={props.labels ?? ["Choose agent", "Connect provider", "Try it"]} ariaLabel="Connection setup progress" />;
}
