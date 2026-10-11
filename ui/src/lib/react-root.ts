import { createRoot, type Root } from "react-dom/client";

export interface ClayonReactRootHost {
  __clayonReactRoot?: Root;
}

type CreateRoot = (container: Parameters<typeof createRoot>[0]) => Root;

/**
 * Keep one React root per browser window even if Vite evaluates the entry
 * module more than once during a development reload.
 */
export function getOrCreateClayonReactRoot(
  host: object,
  container: Parameters<typeof createRoot>[0],
  create: CreateRoot = createRoot,
): Root {
  const rootHost = host as ClayonReactRootHost;
  if (rootHost.__clayonReactRoot) return rootHost.__clayonReactRoot;

  const root = create(container);
  rootHost.__clayonReactRoot = root;
  return root;
}
