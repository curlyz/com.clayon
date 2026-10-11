import { useSyncExternalStore } from "react";
import { z } from "zod";

/*
 * One user preference for primary navigation shape (ADDENDUM 2 of the
 * 2026-10-11 redesign): "dock" = Gold-style bottom dock is the only primary
 * nav at every width; "sidebar" = left primary sidebar with the dock below lg.
 * Default "dock". Persisted to localStorage key `clayon.navLayout`.
 *
 * Implemented as a tiny useSyncExternalStore store rather than zustand for
 * now: zustand is not resolvable from `ui/` (not in ui dependencies; pnpm
 * strict node_modules) and the brief forbids installs while disk is tight.
 * The exported contract matches the zustand shape named in the brief, so the
 * internals can swap to zustand without touching consumers when an install
 * is authorized. Client-only Vite SPA: window/localStorage are always there.
 */

const navLayoutSchema = z.enum(["dock", "sidebar"]);
export type NavLayout = z.output<typeof navLayoutSchema>;

const STORAGE_KEY = "clayon.navLayout";
const DEFAULT_LAYOUT: NavLayout = "dock";

// The stored value is unknown input: one zod parse at the boundary, the
// default on anything else.
function readStoredLayout(): NavLayout {
  return navLayoutSchema.safeParse(window.localStorage.getItem(STORAGE_KEY)).data ?? DEFAULT_LAYOUT;
}

let currentLayout = readStoredLayout();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): NavLayout {
  return currentLayout;
}

function setNavLayout(next: NavLayout): void {
  if (next === currentLayout) return;
  currentLayout = next;
  window.localStorage.setItem(STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

/** Read the current nav layout preference (default "dock"). */
export function useNavLayout(): NavLayout {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Set the nav layout preference; persists to localStorage. */
export { setNavLayout };
