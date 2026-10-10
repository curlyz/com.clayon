import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { agentStatusDot, agentStatusDotDefault } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import {
  AGENT_STATUS_LIGHT,
  AGENT_STATUS_LIGHT_DEFAULT,
  AGENT_WORLD_TRAVEL_BOUND,
  type AgentWorldAgent,
  type AgentWorldPeerRegistry,
  type AgentWorldScenePalette,
} from "./agentWorldScene";

/* ------------------------------------------------------------------ */
/*  Behavior tuning                                                    */
/* ------------------------------------------------------------------ */

/** Cruising speed per status (units/s). Missing statuses stand still. */
const CRUISE_SPEED: Record<string, number> = {
  running: 2.1,
  active: 0.85,
  error: 0.95,
};

/** Turn rate (rad/s) and waypoint arrival radius. */
const TURN_RATE = 3.2;
const ARRIVE_RADIUS = 0.35;
/** How close another `active` agent must be to strike up an interaction. */
const INTERACT_RANGE = 2.9;

interface AgentRuntime {
  x: number;
  z: number;
  yaw: number;
  speed: number;
  targetX: number;
  targetZ: number;
  /** Seconds left dwelling at a waypoint or interacting with a peer. */
  dwell: number;
  /** Peer position to face while dwelling, when interacting. */
  faceX: number | null;
  faceZ: number | null;
  interactCooldown: number;
  gait: number;
  time: number;
  seed: number;
  rand: () => number;
  /** Blended pose parameters, lerped every frame for smooth transitions. */
  sit: number;
  dim: number;
  slump: number;
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

/** Deterministic PRNG so each agent's wander pattern is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createRuntime(agent: AgentWorldAgent, spawn: { x: number; z: number }): AgentRuntime {
  const rand = mulberry32(hashSeed(agent.id));
  const runtime: AgentRuntime = {
    x: spawn.x,
    z: spawn.z,
    yaw: Math.atan2(-spawn.x, -spawn.z),
    speed: 0,
    targetX: spawn.x,
    targetZ: spawn.z,
    dwell: 0,
    faceX: null,
    faceZ: null,
    interactCooldown: rand() * 4,
    gait: rand() * Math.PI * 2,
    time: 0,
    seed: hashSeed(agent.id),
    rand,
    sit: 0,
    dim: 0,
    slump: 0,
  };
  retarget(runtime, agent.status);
  return runtime;
}

function retarget(rt: AgentRuntime, status: string) {
  if (status === "active") {
    // Milling: short hops near the current position.
    rt.targetX = THREE.MathUtils.clamp(rt.x + (rt.rand() * 2 - 1) * 3.4, -AGENT_WORLD_TRAVEL_BOUND, AGENT_WORLD_TRAVEL_BOUND);
    rt.targetZ = THREE.MathUtils.clamp(rt.z + (rt.rand() * 2 - 1) * 3.4, -AGENT_WORLD_TRAVEL_BOUND, AGENT_WORLD_TRAVEL_BOUND);
  } else {
    // Purposeful crossing: anywhere in the world.
    rt.targetX = (rt.rand() * 2 - 1) * AGENT_WORLD_TRAVEL_BOUND;
    rt.targetZ = (rt.rand() * 2 - 1) * AGENT_WORLD_TRAVEL_BOUND;
  }
}

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function steerYaw(rt: AgentRuntime, desiredYaw: number, dt: number, rate: number) {
  rt.yaw += THREE.MathUtils.clamp(shortestAngle(rt.yaw, desiredYaw), -rate * dt, rate * dt);
}

function nearestActivePeer(
  peers: AgentWorldPeerRegistry,
  selfId: string,
  x: number,
  z: number,
): { x: number; z: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestDist = INTERACT_RANGE;
  peers.forEach((peer, id) => {
    if (id === selfId || peer.status !== "active") return;
    const dist = Math.hypot(peer.x - x, peer.z - z);
    if (dist < bestDist) {
      bestDist = dist;
      best = peer;
    }
  });
  return best;
}

/* ------------------------------------------------------------------ */
/*  Character                                                          */
/* ------------------------------------------------------------------ */

interface AgentCharacterMaterials {
  body: THREE.MeshStandardMaterial;
  limbs: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  shadow: THREE.MeshBasicMaterial;
  baseBody: THREE.Color;
  baseLimbs: THREE.Color;
  baseHead: THREE.Color;
  dimTone: THREE.Color;
}

function createMaterials(agent: AgentWorldAgent, palette: AgentWorldScenePalette): AgentCharacterMaterials {
  const accent = new THREE.Color(agent.accentColor);
  return {
    body: new THREE.MeshStandardMaterial({
      color: accent.clone(),
      roughness: 0.55,
      metalness: 0.05,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0,
    }),
    limbs: new THREE.MeshStandardMaterial({
      color: accent.clone().multiplyScalar(0.68),
      roughness: 0.7,
    }),
    head: new THREE.MeshStandardMaterial({
      color: accent.clone().offsetHSL(0, -0.08, 0.16),
      roughness: 0.5,
    }),
    eye: new THREE.MeshStandardMaterial({ color: new THREE.Color(0x18181b), roughness: 0.35 }),
    lamp: new THREE.MeshStandardMaterial({
      color: new THREE.Color(AGENT_STATUS_LIGHT[agent.status] ?? AGENT_STATUS_LIGHT_DEFAULT),
      emissive: new THREE.Color(AGENT_STATUS_LIGHT[agent.status] ?? AGENT_STATUS_LIGHT_DEFAULT),
      emissiveIntensity: 0.9,
    }),
    shadow: new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.contactShadow),
      transparent: true,
      opacity: palette.contactShadowOpacity,
      depthWrite: false,
    }),
    baseBody: accent.clone(),
    baseLimbs: accent.clone().multiplyScalar(0.68),
    baseHead: accent.clone().offsetHSL(0, -0.08, 0.16),
    dimTone: new THREE.Color(palette.dimTone),
  };
}

export interface AgentCharacter3DProps {
  agent: AgentWorldAgent;
  palette: AgentWorldScenePalette;
  peers: AgentWorldPeerRegistry;
  spawn: { x: number; z: number };
}

/**
 * Stylized low-poly agent (capsule body, cylinder limbs, sphere head) with
 * status-driven steering — no physics, no external assets:
 *
 * - running: purposeful walking between waypoints across the world
 * - active: slow milling, occasionally pausing to face a nearby peer
 * - idle / paused: standing with a slow breathing bob (paused slumps)
 * - error: irregular stumbling with a pulsing red body
 * - offline: sitting still, desaturated and dimmed
 *
 * Honors `prefers-reduced-motion` by freezing to a static pose.
 */
export function AgentCharacter3D({ agent, palette, peers, spawn }: AgentCharacter3DProps) {
  const reduced = usePrefersReducedMotion();

  const rootRef = useRef<THREE.Group | null>(null);
  const tiltRef = useRef<THREE.Group | null>(null);
  const postureRef = useRef<THREE.Group | null>(null);
  const headRef = useRef<THREE.Group | null>(null);
  const legLRef = useRef<THREE.Group | null>(null);
  const legRRef = useRef<THREE.Group | null>(null);
  const armLRef = useRef<THREE.Group | null>(null);
  const armRRef = useRef<THREE.Group | null>(null);

  const runtimeRef = useRef<AgentRuntime | null>(null);
  if (runtimeRef.current === null) runtimeRef.current = createRuntime(agent, spawn);

  const materials = useMemo(
    () => createMaterials(agent, palette),
    [agent.accentColor, agent.status, palette],
  );

  useEffect(() => {
    return () => {
      materials.body.dispose();
      materials.limbs.dispose();
      materials.head.dispose();
      materials.eye.dispose();
      materials.lamp.dispose();
      materials.shadow.dispose();
    };
  }, [materials]);

  useEffect(() => {
    return () => {
      peers.delete(agent.id);
    };
  }, [peers, agent.id]);

  useFrame((_, delta) => {
    const rt = runtimeRef.current;
    const root = rootRef.current;
    const tilt = tiltRef.current;
    const posture = postureRef.current;
    const head = headRef.current;
    const legL = legLRef.current;
    const legR = legRRef.current;
    const armL = armLRef.current;
    const armR = armRRef.current;
    if (
      rt === null || root === null || tilt === null || posture === null || head === null ||
      legL === null || legR === null || armL === null || armR === null
    ) return;

    const status = agent.status;
    const isError = status === "error";
    const isOffline = status === "offline";

    const applyVisuals = (dt: number, frozen: boolean) => {
      root.position.set(rt.x, 0, rt.z);
      root.rotation.y = rt.yaw + (!frozen && isError ? Math.sin(rt.time * 2.4 + rt.seed) * 0.2 : 0);

      const speedFactor = frozen ? 0 : THREE.MathUtils.clamp(rt.speed / 2.1, 0, 1);
      if (!frozen) rt.gait += dt * (2.6 + rt.speed * 3.6);
      const swing = Math.sin(rt.gait) * 0.55 * speedFactor;
      const breathe = frozen ? 0 : Math.sin(rt.time * 1.7 + rt.seed) * (1 - speedFactor);

      legL.rotation.x = THREE.MathUtils.lerp(swing, -1.35, rt.sit);
      legR.rotation.x = THREE.MathUtils.lerp(-swing, -1.35, rt.sit);
      armL.rotation.x = THREE.MathUtils.lerp(-swing * 0.7, -0.55, rt.sit);
      armR.rotation.x = THREE.MathUtils.lerp(swing * 0.7, -0.55, rt.sit);

      posture.position.y =
        -0.34 * rt.sit + Math.abs(Math.sin(rt.gait)) * 0.05 * speedFactor + breathe * 0.015;
      posture.rotation.x = rt.sit * -0.1 + rt.slump * 0.08;
      head.rotation.x = rt.slump * 0.35 + breathe * 0.02 - rt.sit * 0.05;

      if (!frozen && isError) {
        tilt.rotation.z = Math.sin(rt.time * 3.3 + rt.seed) * 0.14;
        tilt.rotation.x = Math.max(0, Math.sin(rt.time * 1.3 + rt.seed * 2)) * 0.3;
      } else {
        tilt.rotation.z = 0;
        tilt.rotation.x = 0;
      }

      materials.body.color.copy(materials.baseBody).lerp(materials.dimTone, rt.dim * 0.7);
      materials.limbs.color.copy(materials.baseLimbs).lerp(materials.dimTone, rt.dim * 0.7);
      materials.head.color.copy(materials.baseHead).lerp(materials.dimTone, rt.dim * 0.7);
      const targetEmissive = !frozen && isError ? 0.4 + 0.3 * Math.sin(rt.time * 5.2) : 0;
      materials.body.emissiveIntensity = frozen
        ? targetEmissive
        : THREE.MathUtils.lerp(materials.body.emissiveIntensity, targetEmissive, Math.min(1, dt * 8));
    };

    if (reduced) {
      // Reduced motion: snap to a static standing/sitting pose, no pulses.
      rt.speed = 0;
      rt.sit = isOffline ? 1 : 0;
      rt.dim = isOffline ? 1 : 0;
      rt.slump = status === "paused" ? 1 : 0;
      peers.set(agent.id, { x: rt.x, z: rt.z, status });
      applyVisuals(0, true);
      return;
    }

    const dt = Math.min(delta, 0.05);
    rt.time += dt;

    // --- steering -------------------------------------------------------
    const cruise = CRUISE_SPEED[status] ?? 0;
    let desiredSpeed = 0;
    rt.interactCooldown = Math.max(0, rt.interactCooldown - dt);

    if (cruise > 0 && rt.dwell <= 0) {
      const dx = rt.targetX - rt.x;
      const dz = rt.targetZ - rt.z;
      const dist = Math.hypot(dx, dz);
      if (dist < ARRIVE_RADIUS) {
        if (status === "running") rt.dwell = 0.2 + rt.rand() * 0.7;
        else if (status === "active") rt.dwell = 0.9 + rt.rand() * 1.7;
        else rt.dwell = 0.1 + rt.rand() * 0.4;
        rt.faceX = null;
        rt.faceZ = null;
        retarget(rt, status);
      } else {
        steerYaw(rt, Math.atan2(dx, dz), dt, TURN_RATE);
        desiredSpeed = cruise * THREE.MathUtils.clamp(dist / 1.4, 0.4, 1);
      }
    } else if (rt.dwell > 0) {
      rt.dwell -= dt;
    }

    // --- active: occasionally face a nearby peer -------------------------
    if (status === "active" && rt.dwell <= 0 && rt.interactCooldown <= 0) {
      const partner = nearestActivePeer(peers, agent.id, rt.x, rt.z);
      if (partner) {
        rt.faceX = partner.x;
        rt.faceZ = partner.z;
        rt.dwell = 2.2 + rt.rand() * 1.6;
        rt.interactCooldown = 7 + rt.rand() * 6;
      }
    }
    if (rt.dwell > 0 && rt.faceX !== null && rt.faceZ !== null) {
      steerYaw(rt, Math.atan2(rt.faceX - rt.x, rt.faceZ - rt.z), dt, TURN_RATE * 0.7);
    }

    // Error agents shuffle unevenly instead of walking cleanly.
    if (isError) desiredSpeed *= 0.5 + 0.5 * Math.abs(Math.sin(rt.time * 2.6 + rt.seed));

    rt.speed += (desiredSpeed - rt.speed) * Math.min(1, dt * 4);
    if (rt.speed > 0.001) {
      rt.x += Math.sin(rt.yaw) * rt.speed * dt;
      rt.z += Math.cos(rt.yaw) * rt.speed * dt;
    }

    peers.set(agent.id, { x: rt.x, z: rt.z, status });

    // --- pose blends ------------------------------------------------------
    const blend = Math.min(1, dt * 3.5);
    rt.sit += ((isOffline ? 1 : 0) - rt.sit) * blend;
    rt.dim += ((isOffline ? 1 : 0) - rt.dim) * blend;
    rt.slump += ((status === "paused" ? 1 : 0) - rt.slump) * blend;

    applyVisuals(dt, false);
  });

  return (
    <group ref={rootRef}>
      <group ref={tiltRef}>
        <group ref={postureRef}>
          {/* Legs — pivot at the hip so the swing reads as a step. */}
          <group ref={legLRef} position={[0.11, 0.52, 0]}>
            <mesh position={[0, -0.26, 0]} material={materials.limbs}>
              <cylinderGeometry args={[0.07, 0.09, 0.52, 6]} />
            </mesh>
          </group>
          <group ref={legRRef} position={[-0.11, 0.52, 0]}>
            <mesh position={[0, -0.26, 0]} material={materials.limbs}>
              <cylinderGeometry args={[0.07, 0.09, 0.52, 6]} />
            </mesh>
          </group>
          {/* Body */}
          <mesh position={[0, 0.92, 0]} material={materials.body}>
            <capsuleGeometry args={[0.22, 0.4, 3, 8]} />
          </mesh>
          {/* Arms — pivot at the shoulder. */}
          <group ref={armLRef} position={[0.3, 1.1, 0]}>
            <mesh position={[0, -0.22, 0]} material={materials.limbs}>
              <cylinderGeometry args={[0.055, 0.07, 0.44, 6]} />
            </mesh>
          </group>
          <group ref={armRRef} position={[-0.3, 1.1, 0]}>
            <mesh position={[0, -0.22, 0]} material={materials.limbs}>
              <cylinderGeometry args={[0.055, 0.07, 0.44, 6]} />
            </mesh>
          </group>
          {/* Head with eyes and a status lamp on an antenna. */}
          <group ref={headRef} position={[0, 1.48, 0]}>
            <mesh material={materials.head}>
              <sphereGeometry args={[0.17, 10, 8]} />
            </mesh>
            <mesh position={[0.06, 0.02, 0.15]} material={materials.eye}>
              <sphereGeometry args={[0.024, 6, 5]} />
            </mesh>
            <mesh position={[-0.06, 0.02, 0.15]} material={materials.eye}>
              <sphereGeometry args={[0.024, 6, 5]} />
            </mesh>
            <mesh position={[0, 0.2, 0]} material={materials.limbs}>
              <cylinderGeometry args={[0.012, 0.012, 0.12, 5]} />
            </mesh>
            <mesh position={[0, 0.29, 0]} material={materials.lamp}>
              <sphereGeometry args={[0.045, 8, 6]} />
            </mesh>
          </group>
        </group>
      </group>
      {/* Fake contact shadow — cheaper than real shadow maps. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} material={materials.shadow}>
        <circleGeometry args={[0.34, 20]} />
      </mesh>
      <Html position={[0, 2.08, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <AgentLabel agent={agent} />
      </Html>
    </group>
  );
}

/** Floating name + status label rendered as token-styled DOM over the canvas. */
function AgentLabel({ agent }: { agent: AgentWorldAgent }) {
  const statusText = agent.status.replace(/[_-]/g, " ");
  const dotClass = agentStatusDot[agent.status] ?? agentStatusDotDefault;
  return (
    <div className="pointer-events-none flex flex-col items-center gap-0.5 rounded-md border border-border bg-background/90 px-2 py-1 text-center">
      <span className="whitespace-nowrap text-xs font-medium leading-tight text-foreground">
        {agent.name}
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap text-(length:--text-nano) leading-tight text-muted-foreground">
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotClass)} aria-hidden="true" />
        {statusText}
      </span>
      {agent.activityLabel ? (
        <span className="whitespace-nowrap text-(length:--text-nano) leading-tight text-muted-foreground/80">
          {agent.activityLabel}
        </span>
      ) : null}
    </div>
  );
}
