// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClayonLoading } from "./AnimatedClayonIcon";

describe("ClayonLoading", () => {
  it("renders an accessible full-page loading state", () => {
    const html = renderToStaticMarkup(<ClayonLoading />);

    expect(html).toContain('role="status"');
    expect(html).toContain("min-h-dvh");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<span class="sr-only">Loading…</span>');
  });

  it("allows containing layouts to override the full-page height", () => {
    const html = renderToStaticMarkup(<ClayonLoading className="min-h-0" />);

    expect(html).toContain("min-h-0");
    expect(html).not.toContain("min-h-dvh");
  });
});
