import { describe, expect, it } from "vitest";
import {
  applyUiBranding,
  getWorktreeUiBranding,
  isWorktreeUiBrandingEnabled,
  renderFaviconLinks,
  renderRuntimeBrandingMeta,
} from "../ui-branding.js";

const TEMPLATE = `<!doctype html>
<head>
    <!-- CLAYON_RUNTIME_BRANDING_START -->
    <!-- CLAYON_RUNTIME_BRANDING_END -->
    <!-- CLAYON_FAVICON_START -->
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
    <!-- CLAYON_FAVICON_END -->
</head>`;

describe("ui branding", () => {
  it("detects worktree mode from CLAYON_IN_WORKTREE", () => {
    expect(isWorktreeUiBrandingEnabled({ CLAYON_IN_WORKTREE: "true" })).toBe(true);
    expect(isWorktreeUiBrandingEnabled({ CLAYON_IN_WORKTREE: "1" })).toBe(true);
    expect(isWorktreeUiBrandingEnabled({ CLAYON_IN_WORKTREE: "false" })).toBe(false);
  });

  it("resolves name, color, and text color for worktree branding", () => {
    const branding = getWorktreeUiBranding({
      CLAYON_IN_WORKTREE: "true",
      CLAYON_WORKTREE_NAME: "clayon-pr-432",
      CLAYON_WORKTREE_COLOR: "#4f86f7",
    });

    expect(branding.enabled).toBe(true);
    expect(branding.name).toBe("clayon-pr-432");
    expect(branding.color).toBe("#4f86f7");
    expect(branding.textColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(branding.faviconHref).toContain("data:image/svg+xml,");
  });

  it("renders a dynamic worktree favicon when enabled", () => {
    const links = renderFaviconLinks(
      getWorktreeUiBranding({
        CLAYON_IN_WORKTREE: "true",
        CLAYON_WORKTREE_NAME: "clayon-pr-432",
        CLAYON_WORKTREE_COLOR: "#4f86f7",
      }),
    );
    expect(links).toContain("data:image/svg+xml,");
    expect(links).toContain('rel="shortcut icon"');
  });

  it("renders runtime branding metadata for the ui", () => {
    const meta = renderRuntimeBrandingMeta(
      getWorktreeUiBranding({
        CLAYON_IN_WORKTREE: "true",
        CLAYON_WORKTREE_NAME: "clayon-pr-432",
        CLAYON_WORKTREE_COLOR: "#4f86f7",
      }),
    );
    expect(meta).toContain('name="clayon-worktree-name"');
    expect(meta).toContain('content="clayon-pr-432"');
    expect(meta).toContain('name="clayon-worktree-color"');
  });

  it("surfaces the runtime instance id so the UI can fail closed on copied rows", () => {
    const branding = getWorktreeUiBranding({
      CLAYON_IN_WORKTREE: "true",
      CLAYON_WORKTREE_NAME: "clayon-pr-432",
      CLAYON_WORKTREE_COLOR: "#4f86f7",
      CLAYON_INSTANCE_ID: "inst-abc123",
    });
    expect(branding.instanceId).toBe("inst-abc123");

    const meta = renderRuntimeBrandingMeta(branding);
    expect(meta).toContain('name="clayon-instance-id"');
    expect(meta).toContain('content="inst-abc123"');
  });

  it("omits the instance-id meta when the runtime id is unset", () => {
    const branding = getWorktreeUiBranding({
      CLAYON_IN_WORKTREE: "true",
      CLAYON_WORKTREE_NAME: "clayon-pr-432",
      CLAYON_WORKTREE_COLOR: "#4f86f7",
    });
    expect(branding.instanceId).toBeNull();
    expect(renderRuntimeBrandingMeta(branding)).not.toContain('name="clayon-instance-id"');
  });

  it("rewrites the favicon and runtime branding blocks for worktree instances only", () => {
    const branded = applyUiBranding(TEMPLATE, {
      CLAYON_IN_WORKTREE: "true",
      CLAYON_WORKTREE_NAME: "clayon-pr-432",
      CLAYON_WORKTREE_COLOR: "#4f86f7",
    });
    expect(branded).toContain("data:image/svg+xml,");
    expect(branded).toContain('name="clayon-worktree-name"');
    expect(branded).not.toContain('href="/favicon.svg"');

    const defaultHtml = applyUiBranding(TEMPLATE, {});
    expect(defaultHtml).toContain('href="/favicon.svg"');
    expect(defaultHtml).not.toContain('name="clayon-worktree-name"');
  });
});
