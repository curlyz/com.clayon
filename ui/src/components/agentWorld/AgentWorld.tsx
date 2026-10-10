import { Canvas } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { AgentCharacter3D } from "./AgentCharacter3D";
import {
  AGENT_WORLD_PALETTES,
  AGENT_WORLD_SIZE,
  hasWebGL,
  type AgentWorldAgent,
  type AgentWorldPeerRegistry,
  type AgentWorldScenePalette,
  type AgentWorldTheme,
} from "./agentWorldScene";

export type { AgentWorldAgent, AgentWorldStatus, AgentWorldTheme } from "./agentWorldScene";

/** Evenly spreads spawn points on a ring so agents never clump at start. */
function spawnPoints(count: number): { x: number; z: number }[] {
  const radius = count <= 1 ? 0 : 5.5;
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / Math.max(count, 1)) * Math.PI * 2;
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
  });
}

function AgentWorldScene({
  agents,
  palette,
}: {
  agents: AgentWorldAgent[];
  palette: AgentWorldScenePalette;
}) {
  const peers = useRef<AgentWorldPeerRegistry>(new Map());
  const spawns = useMemo(() => spawnPoints(agents.length), [agents.length]);

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, 16, 42]} />
      {/* Three-point lighting: warm key, tinted fill, cool rim. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[9, 14, 7]} intensity={1.05} />
      <directionalLight position={[-10, 6, -6]} intensity={0.3} color={palette.fillLight} />
      <directionalLight position={[-4, 5, 10]} intensity={0.25} color={palette.rimLight} />
      {/* Wide apron below the ground so the world edge fades into fog. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
        <planeGeometry args={[96, 96]} />
        <meshStandardMaterial color={palette.apron} roughness={1} />
      </mesh>
      {/* Bounded ground. */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[AGENT_WORLD_SIZE, AGENT_WORLD_SIZE]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      <gridHelper
        args={[AGENT_WORLD_SIZE, 12, palette.gridMajor, palette.gridMinor]}
        position={[0, 0.006, 0]}
      />
      {agents.map((agent, index) => (
        <AgentCharacter3D
          key={agent.id}
          agent={agent}
          palette={palette}
          peers={peers.current}
          spawn={spawns[index] ?? { x: 0, z: 0 }}
        />
      ))}
    </>
  );
}

export interface AgentWorldProps {
  agents: AgentWorldAgent[];
  /** Visual theme; read from `useTheme()` at the mount site. */
  theme: AgentWorldTheme;
  className?: string;
}

/** WebGL-less environments (tests, blocked GPUs, old browsers) get no canvas. */

/**
 * Self-contained 3D agent world: soft ground, gentle fog, three-point
 * lighting, and one procedural low-poly character per agent, each moving by
 * status (see `AgentCharacter3D`). No external model or texture assets.
 */
export function AgentWorld({ agents, theme, className }: AgentWorldProps) {
  const palette = AGENT_WORLD_PALETTES[theme];
  const ariaLabel = `3D agent world: ${agents
    .map((agent) => `${agent.name} (${agent.status.replace(/[_-]/g, " ")})`)
    .join(", ")}`;

  // Degrade to a quiet empty band rather than crashing the page when WebGL
  // is unavailable (test environments, blocked GPUs, no-canvas browsers).
  if (!hasWebGL()) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        className={cn("h-64 md:h-80 bg-muted/40", className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("relative h-80 overflow-hidden rounded-xl border border-border bg-muted/40", className)}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [13, 11.5, 13], fov: 36 }}
        gl={{ antialias: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0.9, 0)}
      >
        <AgentWorldScene agents={agents} palette={palette} />
      </Canvas>
    </div>
  );
}
