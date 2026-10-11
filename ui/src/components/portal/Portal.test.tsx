// @vitest-environment jsdom

import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Portal } from "@/components/portal/Portal";

describe("Portal scene", () => {
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

  it("keeps decorative art outside the keyboard path and gives the scene a text equivalent", () => {
    expect(container.querySelector("main h1")?.textContent).toBe("Your mission.");
    expect(container.querySelector(".halo-portal-scene")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("[tabindex='-1']")).toHaveLength(0);
    expect(container.querySelector(".halo-portal-ring")?.getAttribute("src")).toBe("/portal/ring.webp");
  });

  it("lets the operator pause and resume the whole scene", () => {
    const motion = container.querySelector<HTMLButtonElement>(".halo-portal-motion")!;
    flushSync(() => motion.click());
    expect(container.querySelector(".halo-portal")?.getAttribute("data-paused")).toBe("true");
    expect(motion.getAttribute("aria-pressed")).toBe("true");
    expect(motion.getAttribute("aria-label")).toBe("Resume scene motion");
    flushSync(() => motion.click());
    expect(container.querySelector(".halo-portal")?.getAttribute("data-paused")).toBe("false");
  });

  it("tracks the pointer in the scene and restores the rest direction on exit", async () => {
    const scene = container.querySelector<HTMLDivElement>(".halo-portal")!;
    vi.spyOn(scene, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 1280, 800));
    await act(() => scene.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, bubbles: true })));
    expect(scene.getAttribute("data-gaze")).toBe("left");
    await act(() => scene.dispatchEvent(new MouseEvent("pointermove", { clientX: 1200, bubbles: true })));
    expect(scene.getAttribute("data-gaze")).toBe("right");
    await act(() => scene.dispatchEvent(new MouseEvent("pointerout", { bubbles: true })));
    expect(scene.getAttribute("data-gaze")).toBe("center");
  });

});
