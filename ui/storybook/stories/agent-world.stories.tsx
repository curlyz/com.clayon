import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentWorld } from "@/components/agentWorld/AgentWorld";
import {
  AGENT_WORLD_DEMO_AGENTS,
  agentWorldCssHex,
  type AgentWorldAgent,
} from "@/components/agentWorld/agentWorldScene";

/** Full cast covering every behavior: one agent per status. */
const ALL_STATUS_AGENTS: AgentWorldAgent[] = [
  { id: "st-atlas", name: "Atlas", accentColor: agentWorldCssHex(0x2563eb), status: "running", activityLabel: "Indexing workspace" },
  { id: "st-vega", name: "Vega", accentColor: agentWorldCssHex(0x16a34a), status: "active", activityLabel: "Reviewing pull requests" },
  { id: "st-orion", name: "Orion", accentColor: agentWorldCssHex(0xca8a04), status: "paused", activityLabel: "Waiting on budget approval" },
  { id: "st-mira", name: "Mira", accentColor: agentWorldCssHex(0x0d9488), status: "idle" },
  { id: "st-lyra", name: "Lyra", accentColor: agentWorldCssHex(0xdc2626), status: "error", activityLabel: "Recovering from a failed run" },
  { id: "st-nova", name: "Nova", accentColor: agentWorldCssHex(0x7c3aed), status: "offline" },
];

const meta: Meta = {
  title: "Product/Agent world",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

export const MixedStatuses: Story = {
  render: () => (
    <div className="h-screen p-6">
      <AgentWorld agents={AGENT_WORLD_DEMO_AGENTS} theme="dark" className="h-full" />
    </div>
  ),
};

export const AllStatuses: Story = {
  render: () => (
    <div className="h-screen p-6">
      <AgentWorld agents={ALL_STATUS_AGENTS} theme="dark" className="h-full" />
    </div>
  ),
};

export const LightPaperWorld: Story = {
  render: () => (
    <div className="h-screen p-6">
      <AgentWorld agents={ALL_STATUS_AGENTS} theme="light" className="h-full" />
    </div>
  ),
};
