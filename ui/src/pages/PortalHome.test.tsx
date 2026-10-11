// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "@/lib/router";
import { ThemeProvider } from "@/context/ThemeContext";
import { PortalHome } from "@/pages/PortalHome";

const hooks = vi.hoisted(() => ({ useCompany: vi.fn(), useCloudInstance: vi.fn() }));
vi.mock("@/context/CompanyContext", () => ({ useCompany: hooks.useCompany }));
vi.mock("@/hooks/useCloudInstance", () => ({ useCloudInstance: hooks.useCloudInstance }));

describe("Portal root entry", () => {
  let container: HTMLDivElement;
  let root: Root;
  const retryCompanies = vi.fn();
  const firstCompany = { id: "company-first", name: "First Mission", issuePrefix: "ONE" };
  const selectedCompany = { id: "company-selected", name: "Selected Mission", issuePrefix: "TWO" };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    hooks.useCloudInstance.mockReturnValue(null);
    hooks.useCompany.mockReturnValue({
      companies: [firstCompany, selectedCompany],
      selectedCompany,
      loading: false,
      companyListUnavailable: false,
      retryCompanies,
    });
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function render() {
    flushSync(() => root.render(
      <ThemeProvider>
        <MemoryRouter><PortalHome /></MemoryRouter>
      </ThemeProvider>,
    ));
  }

  it("opens the selected company's dashboard without entering automatically", () => {
    render();
    expect(container.querySelector("h1")?.textContent).toBe("Your mission. Ready when you are.");
    expect(container.querySelector(".halo-portal-emblem")?.getAttribute("src")).toBe("/portal/emblem.webp");
    expect(container.querySelector(".halo-portal-scene")).toBeNull();
    expect(container.querySelectorAll("canvas")).toHaveLength(0);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/TWO/dashboard");
    expect(container.textContent).toContain("Step into Selected Mission.");
  });

  it("uses the first company while selection is being resolved", () => {
    hooks.useCompany.mockReturnValue({
      companies: [firstCompany], selectedCompany: null, loading: false, companyListUnavailable: false, retryCompanies,
    });
    render();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/ONE/dashboard");
  });

  it("retries a failed lookup without offering organization creation", () => {
    hooks.useCompany.mockReturnValue({
      companies: [], selectedCompany: null, loading: false, companyListUnavailable: true, retryCompanies,
    });
    render();
    expect(container.querySelector("[role='alert']")?.textContent).toContain("couldn’t load");
    expect(container.querySelector("a")).toBeNull();
    container.querySelector<HTMLButtonElement>(".halo-portal-action")?.click();
    expect(retryCompanies).toHaveBeenCalledOnce();
  });

  it("opens existing onboarding only for an empty self-hosted account", () => {
    hooks.useCompany.mockReturnValue({
      companies: [], selectedCompany: null, loading: false, companyListUnavailable: false, retryCompanies,
    });
    render();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/onboarding");
  });

  it("uses Cloud creation instead of the local organization wizard", () => {
    hooks.useCompany.mockReturnValue({
      companies: [], selectedCompany: null, loading: false, companyListUnavailable: false, retryCompanies,
    });
    hooks.useCloudInstance.mockReturnValue({ cloudBaseUrl: "https://cloud.example.test/v1" });
    render();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://cloud.example.test/stacks/new");
  });

  it("fails closed when a managed instance has no usable creation URL", () => {
    hooks.useCompany.mockReturnValue({
      companies: [], selectedCompany: null, loading: false, companyListUnavailable: false, retryCompanies,
    });
    hooks.useCloudInstance.mockReturnValue({ cloudBaseUrl: "invalid" });
    render();
    expect(container.querySelector("[role='alert']")?.textContent).toContain("creation is unavailable");
    expect(container.querySelector("a")).toBeNull();
  });
});
