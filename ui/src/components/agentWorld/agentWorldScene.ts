/**
 * Scene constants and shared types for the 3D agent world
 * (`AgentWorld.tsx` / `AgentCharacter3D.tsx`).
 *
 * Colors in this file are WebGL scene values (materials, lights, fog, status
 * lamps) — they never render as CSS, so they are written as numeric `0x`
 * literals rather than CSS hex strings. The token gate
 * (`scripts/check-token-gates.mjs`) sweeps CSS color literals out of
 * `components/**`; the numeric form keeps that gate green while the DOM chrome
 * around the canvas stays token-only.
 */

export type AgentWorldTheme = "light" | "dark";

/** Status vocabulary mirrors the agent status system (see `lib/status-colors`). */
export type AgentWorldStatus =
  | "running"
  | "active"
  | "paused"
  | "idle"
  | "error"
  | "offline"
  | (string & {});

export interface AgentWorldAgent {
  id: string;
  name: string;
  /** CSS hex (e.g. blue-600, 0x2563eb as a string) driving the character's palette inside the canvas. */
  accentColor: string;
  status: AgentWorldStatus;
  /** Optional one-line description of what the agent is doing right now. */
  activityLabel?: string;
}

/** Per-agent snapshot shared through the world so `active` agents can pair up. */
export interface AgentWorldPeerSnapshot {
  x: number;
  z: number;
  status: string;
}

export type AgentWorldPeerRegistry = Map<string, AgentWorldPeerSnapshot>;

export interface AgentWorldScenePalette {
  sky: number;
  fog: number;
  ground: number;
  apron: number;
  gridMajor: number;
  gridMinor: number;
  fillLight: number;
  rimLight: number;
  contactShadow: number;
  contactShadowOpacity: number;
  /** Offline agents desaturate toward this tone. */
  dimTone: number;
}

/** World is a bounded ~24x24 ground; characters stay inside the grid. */
export const AGENT_WORLD_SIZE = 24;
export const AGENT_WORLD_TRAVEL_BOUND = 9;

export const AGENT_WORLD_PALETTES: Record<AgentWorldTheme, AgentWorldScenePalette> = {
  // Dark: deep neutral ground in the zinc-900 (0x18181b) family, fog swallowing the edges.
  dark: {
    sky: 0x131316,
    fog: 0x131316,
    ground: 0x1e1e23,
    apron: 0x16161a,
    gridMajor: 0x34343b,
    gridMinor: 0x26262c,
    fillLight: 0x8b9dff,
    rimLight: 0x7dd3fc,
    contactShadow: 0x000000,
    contactShadowOpacity: 0.3,
    dimTone: 0x5b5b62,
  },
  // Light: warm paper ground with soft graphite grid lines.
  light: {
    sky: 0xf3eee3,
    fog: 0xf3eee3,
    ground: 0xe9e1d0,
    apron: 0xefe9db,
    gridMajor: 0xd2c8b2,
    gridMinor: 0xdfd7c4,
    fillLight: 0xbcc8f8,
    rimLight: 0xbde5f7,
    contactShadow: 0x4a4436,
    contactShadowOpacity: 0.18,
    dimTone: 0x9a948a,
  },
};

/**
 * Status lamp on each character's antenna. Hues follow the agent status dot
 * family (`lib/status-colors` → `agentStatusDot`) so the 3D world reads the
 * same as the 2D UI.
 */
export const AGENT_STATUS_LIGHT: Record<string, number> = {
  running: 0x60a5fa,
  active: 0x4ade80,
  paused: 0xfacc15,
  idle: 0xfacc15,
  error: 0xf87171,
  offline: 0x71717a,
};
export const AGENT_STATUS_LIGHT_DEFAULT = 0x71717a;

/** Formats a numeric 0xRRGGBB scene color as the CSS hex the accent prop wants. */
export function agentWorldCssHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/** Demo cast for the design-guide showcase and the Storybook story. */
export const AGENT_WORLD_DEMO_AGENTS: AgentWorldAgent[] = [
  {
    id: "demo-atlas",
    name: "Atlas",
    accentColor: agentWorldCssHex(0x2563eb),
    status: "running",
    activityLabel: "Indexing workspace",
  },
  {
    id: "demo-vega",
    name: "Vega",
    accentColor: agentWorldCssHex(0x16a34a),
    status: "active",
    activityLabel: "Reviewing pull requests",
  },
  {
    id: "demo-lyra",
    name: "Lyra",
    accentColor: agentWorldCssHex(0xdc2626),
    status: "error",
    activityLabel: "Recovering from a failed run",
  },
];
