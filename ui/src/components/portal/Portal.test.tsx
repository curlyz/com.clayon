// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Portal } from "@/components/portal/Portal";

// Scene-free portal (leader ruling 2026-10-11): no decorative ring/orbit
// layer, no pause control, no gaze tracking — a flat theme-aware surface
// with the masked emblem as the logo.
describe("Portal surface", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    flushSync(() => root.render(
      <Portal><h1>Your mission.</h1><button type="button">Enter Clayon</button></Portal>,
    ));
  });
  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the content in the reading order with the emblem as the only logo", () => {
    expect(container.querySelector("main h1")?.textContent).toBe("Your mission.");
    const emblem = container.querySelector<HTMLImageElement>(".halo-portal-emblem");
    expect(emblem?.getAttribute("src")).toBe("/portal/emblem.webp");
    expect(emblem?.getAttribute("aria-hidden")).toBe("true");
  });

  it("ships no decorative scene, pause control, or focus hacks", () => {
    expect(container.querySelector(".halo-portal-scene")).toBeNull();
    expect(container.querySelector(".halo-portal-ring")).toBeNull();
    expect(container.querySelector(".halo-portal-orbit")).toBeNull();
    expect(container.querySelector(".halo-portal-motion")).toBeNull();
    expect(container.querySelectorAll("[tabindex='-1']")).toHaveLength(0);
  });

  it("carries the footer detail line", () => {
    expect(container.querySelector(".halo-portal-footer")?.textContent).toContain("Built around your mission.");
  });
});
