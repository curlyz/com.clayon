import type { Meta, StoryObj } from "@storybook/react-vite";
import { ManagedOAuthHandoffState } from "@/pages/apps/ClayonCloudOAuthHandoff";

const meta: Meta<typeof ManagedOAuthHandoffState> = {
  title: "Apps/Managed Cloud OAuth handoff",
  component: ManagedOAuthHandoffState,
  parameters: { layout: "fullscreen" },
  args: {
    onRetry: () => undefined,
    onCancel: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof ManagedOAuthHandoffState>;

export const PreparingProvider: Story = {
  args: { phase: "loading" },
};

export const ResumingAfterReauthentication: Story = {
  args: { phase: "reauthenticating" },
};

export const RetryAfterInfrastructureFailure: Story = {
  args: {
    phase: "error",
    error: "Clayon Cloud couldn’t prepare secure sign-in. Try again.",
  },
};

export const TerminalExpiredSession: Story = {
  args: {
    phase: "error",
    error: "This sign-in expired. Return to Clayon and start the connection again.",
  },
};
