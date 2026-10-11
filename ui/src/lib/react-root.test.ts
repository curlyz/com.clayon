import { describe, expect, it, vi } from "vitest";
import type { Root } from "react-dom/client";
import {
  getOrCreateClayonReactRoot,
  type ClayonReactRootHost,
} from "./react-root";

describe("getOrCreateClayonReactRoot", () => {
  it("reuses the existing root when the entry module runs again", () => {
    const host: ClayonReactRootHost = {};
    const container = {} as Parameters<typeof getOrCreateClayonReactRoot>[1];
    const root = { render: vi.fn(), unmount: vi.fn() } as unknown as Root;
    const createRoot = vi.fn(() => root);

    expect(getOrCreateClayonReactRoot(host, container, createRoot)).toBe(root);
    expect(getOrCreateClayonReactRoot(host, container, createRoot)).toBe(root);
    expect(createRoot).toHaveBeenCalledTimes(1);
    expect(createRoot).toHaveBeenCalledWith(container);
  });
});
