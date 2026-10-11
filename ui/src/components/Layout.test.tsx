// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";

const mockHealthApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

const mockInstanceSettingsApi = vi.hoisted(() => ({
  getGeneral: vi.fn(),
  getExperimental: vi.fn(),
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetSelectedCompanyId = vi.hoisted(() => vi.fn());
const mockSetSidebarOpen = vi.hoisted(() => vi.fn());
const mockCompanyState = vi.hoisted(() => ({
  companies: [{ id: "company-1", issuePrefix: "PAP", name: "Clayon" }],
  selectedCompany: { id: "company-1", issuePrefix: "PAP", name: "Clayon" },
  selectedCompanyId: "company-1",
}));
const mockPluginSlots = vi.hoisted(() => ({
  slots: [] as Array<Record<string, unknown>>,
}));
const mockUsePluginSlots = vi.hoisted(() => vi.fn());
const mockPluginSlotContexts = vi.hoisted(
  () => [] as Array<Record<string, unknown>>,
);
const mockSetPeeking = vi.hoisted(() => vi.fn());
const mockSetForceCollapsed = vi.hoisted(() => vi.fn());
const mockSidebarState = vi.hoisted(() => ({
  sidebarOpen: true,
  isMobile: false,
  collapsed: false,
  peeking: false,
}));
let currentPathname = "/PAP/dashboard";

vi.mock("@/lib/router", () => ({
  Outlet: () => <div>Outlet content</div>,
  useLocation: () => ({
    pathname: currentPathname,
    search: "",
    hash: "",
    state: null,
  }),
  useNavigate: () => mockNavigate,
  useNavigationType: () => "PUSH",
  useParams: () => {
    const [firstSegment, secondSegment, entityId] = currentPathname
      .split("/")
      .filter(Boolean);
    return {
      companyPrefix: firstSegment ?? "PAP",
      pluginRoutePath: secondSegment,
      agentId: secondSegment === "agents" ? entityId : undefined,
      routineId: secondSegment === "routines" ? entityId : undefined,
    };
  },
}));

vi.mock("./Sidebar", () => ({
  Sidebar: ({ contentHeaderControls }: { contentHeaderControls?: boolean }) => (
    <div data-content-header-controls={String(contentHeaderControls ?? false)}>
      Main company nav
    </div>
  ),
}));

vi.mock("./BreadcrumbBar", () => ({
  BreadcrumbBar: () => <div>Breadcrumbs</div>,
}));

vi.mock("./PropertiesPanel", () => ({
  PropertiesPanel: () => null,
}));

// Overlay account/company lifecycle has its own integration test. These tests
// exercise route navigation with intentionally minimal context providers.
vi.mock("./PluginAppShellOverlays", () => ({
  PluginAppShellOverlays: () => null,
}));

vi.mock("./CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("./NewIssueDialog", () => ({
  NewIssueDialog: () => null,
}));

vi.mock("./NewProjectDialog", () => ({
  NewProjectDialog: () => null,
}));

vi.mock("./NewGoalDialog", () => ({
  NewGoalDialog: () => null,
}));

vi.mock("./NewAgentDialog", () => ({
  NewAgentDialog: () => null,
}));

vi.mock("./KeyboardShortcutsCheatsheet", () => ({
  KeyboardShortcutsCheatsheet: () => null,
}));

vi.mock("./ToastViewport", () => ({
  ToastViewport: () => null,
}));

vi.mock("./AnnouncementWell", () => ({
  AnnouncementWell: () => <div data-announcement-well />,
}));

vi.mock("./dock/Dock", () => ({
  Dock: () => null,
}));

// The shell tests below cover the sidebar layout; the dock layout has its
// own surface. Pinned via the store mock so the persisted default ("dock")
// doesn't flip these mid-run.
const mockNavLayout = vi.hoisted(() => ({ value: "sidebar" as "dock" | "sidebar" }));
vi.mock("../stores/navLayoutStore", () => ({
  useNavLayout: () => mockNavLayout.value,
  setNavLayout: vi.fn(),
}));

vi.mock("./WorktreeBanner", () => ({
  WorktreeBanner: () => null,
}));

vi.mock("./DevRestartBanner", () => ({
  DevRestartBanner: () => null,
}));

vi.mock("./SidebarAccountMenu", () => ({
  SidebarAccountMenu: () => <div>Account menu</div>,
}));

vi.mock("../plugins/slots", async () => {
  const actual =
    await vi.importActual<typeof import("../plugins/slots")>(
      "../plugins/slots",
    );
  return {
    resolveRouteSidebarSlot: actual.resolveRouteSidebarSlot,
    usePluginSlots: (params: Record<string, unknown>) => {
      mockUsePluginSlots(params);
      return {
        slots: mockPluginSlots.slots,
        isLoading: false,
        errorMessage: null,
      };
    },
    PluginSlotMount: ({
      slot,
      context,
      className,
    }: {
      slot: { displayName: string };
      context: Record<string, unknown>;
      className?: string;
    }) => {
      mockPluginSlotContexts.push(context);
      return (
        <div data-plugin-slot-class={className}>
          Plugin route sidebar: {slot.displayName}
        </div>
      );
    },
  };
});

vi.mock("../context/DialogContext", () => ({
  useDialog: () => ({
    openNewIssue: vi.fn(),
    openOnboarding: vi.fn(),
  }),
  useDialogActions: () => ({
    openNewIssue: vi.fn(),
    openOnboarding: vi.fn(),
  }),
}));

vi.mock("../context/PanelContext", () => ({
  usePanel: () => ({
    togglePanelVisible: vi.fn(),
  }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    companies: mockCompanyState.companies,
    loading: false,
    selectedCompany: mockCompanyState.selectedCompany,
    selectedCompanyId: mockCompanyState.selectedCompanyId,
    selectionSource: "manual",
    setSelectedCompanyId: mockSetSelectedCompanyId,
  }),
}));

vi.mock("../context/SidebarContext", () => ({
  useSidebar: () => ({
    sidebarOpen: mockSidebarState.sidebarOpen,
    setSidebarOpen: mockSetSidebarOpen,
    toggleSidebar: vi.fn(),
    toggleCollapsed: vi.fn(),
    collapsed: mockSidebarState.collapsed,
    peeking: mockSidebarState.peeking,
    setPeeking: mockSetPeeking,
    setForceCollapsed: mockSetForceCollapsed,
    isMobile: mockSidebarState.isMobile,
    routeRequestsCollapsed: false,
    setRouteRequestsCollapsed: vi.fn(),
  }),
}));

vi.mock("../hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => undefined,
}));

vi.mock("../hooks/useCompanyPageMemory", () => ({
  useCompanyPageMemory: () => undefined,
}));

vi.mock("../api/health", () => ({
  healthApi: mockHealthApi,
}));

vi.mock("../api/instanceSettings", () => ({
  instanceSettingsApi: mockInstanceSettingsApi,
}));

vi.mock("../lib/company-selection", () => ({
  shouldSyncCompanySelectionFromRoute: () => false,
  // No bounce in the shared harness: these tests exercise layout chrome, not
  // archived-company routing (covered by company-selection unit tests and the
  // archived-company-url e2e).
  resolveArchivedCompanyBounce: () => null,
}));

vi.mock("../lib/main-content-focus", () => ({
  scheduleMainContentFocus: () => () => undefined,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function act(callback: () => void | Promise<void>) {
  let result: void | Promise<void> = undefined;
  flushSync(() => {
    result = callback();
  });
  await result;
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("Layout", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    currentPathname = "/PAP/dashboard";
    mockCompanyState.companies = [
      { id: "company-1", issuePrefix: "PAP", name: "Clayon" },
    ];
    mockCompanyState.selectedCompany = {
      id: "company-1",
      issuePrefix: "PAP",
      name: "Clayon",
    };
    mockCompanyState.selectedCompanyId = "company-1";
    mockHealthApi.get.mockResolvedValue({
      status: "ok",
      deploymentMode: "authenticated",
      deploymentExposure: "private",
      version: "1.2.3",
    });
    mockInstanceSettingsApi.getGeneral.mockResolvedValue({
      censorUsernameInLogs: false,
    });
    mockInstanceSettingsApi.getExperimental.mockResolvedValue({
      enableApps: true,
    });
    mockPluginSlots.slots = [];
    mockPluginSlotContexts.length = 0;
    mockSidebarState.sidebarOpen = true;
    mockSidebarState.isMobile = false;
    mockSidebarState.collapsed = false;
    mockSidebarState.peeking = false;
    mockSetPeeking.mockClear();
    mockSetForceCollapsed.mockClear();
    mockNavLayout.value = "sidebar";
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("does not render the deployment explainer in the shared layout", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(mockHealthApi.get).toHaveBeenCalled();
    expect(container.textContent).toContain("Breadcrumbs");
    expect(container.textContent).toContain("Outlet content");
    expect(container.querySelectorAll("[data-announcement-well]")).toHaveLength(1);
    expect(container.textContent).not.toContain("Company rail");
    expect(container.textContent).not.toContain("Authenticated private");
    expect(container.textContent).not.toContain(
      "Sign-in is required and this instance is intended for private-network access.",
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("scopes the Streamlined task-detail surface while preserving balanced horizontal gutters", async () => {
    currentPathname = "/PAP/issues/PAP-1";
    mockInstanceSettingsApi.getExperimental.mockResolvedValue({
      enableApps: true,
      enableStreamlinedUi: true,
    });
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(
      container.querySelector(".streamlined-task-detail-surface"),
    ).not.toBeNull();
    const mainClasses = container.querySelector("#main-content")?.classList;
    // Full-bleed bands (operator directive, 2026-10-11): the page shell
    // carries no container padding; only the dock clearance remains.
    expect(mainClasses?.contains("p-4")).toBe(false);
    expect(mainClasses?.contains("md:p-6")).toBe(false);
    expect(mainClasses?.contains("max-lg:pb-(--sz-dock-clearance)")).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("collapses atomically when the pointer is still over the sidebar (no re-peek) — PAP-10676", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const renderLayout = async () => {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Layout />
          </QueryClientProvider>,
        );
      });
      await flushReact();
    };

    // The SidebarShell overlay panel carries the peek mouse handlers.
    const panel = () =>
      [...container.querySelectorAll<HTMLElement>("div")].find(
        (el) =>
          el.className.includes("inset-y-0") &&
          el.className.includes("overflow-hidden"),
      );
    const hover = (el: HTMLElement) => {
      // React derives onMouseEnter from a mouseover crossing in from outside.
      el.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
    };

    // Expanded, then hover the panel so the pointer is registered as inside.
    await renderLayout();
    const expandedPanel = panel();
    expect(expandedPanel).toBeTruthy();
    await act(async () => {
      hover(expandedPanel!);
    });

    // Collapse while the pointer is still over the panel.
    mockSidebarState.collapsed = true;
    await renderLayout();
    // The peek is cancelled atomically on collapse.
    expect(mockSetPeeking).toHaveBeenCalledWith(false);

    // A lingering/spurious hover while collapsed must NOT re-open the peek.
    mockSetPeeking.mockClear();
    const railPanel = panel();
    await act(async () => {
      hover(railPanel!);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(mockSetPeeking).not.toHaveBeenCalledWith(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("opens the peek when hovering a collapsed rail (positive control for the hover sim)", async () => {
    mockSidebarState.collapsed = true;
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();

    const panel = [...container.querySelectorAll<HTMLElement>("div")].find(
      (el) =>
        el.className.includes("inset-y-0") &&
        el.className.includes("overflow-hidden"),
    );
    expect(panel).toBeTruthy();
    await act(async () => {
      panel!.dispatchEvent(
        new MouseEvent("mouseover", {
          bubbles: true,
          relatedTarget: document.body,
        }),
      );
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    // A normal collapsed-rail hover (not just-collapsed) opens the peek.
    expect(mockSetPeeking).toHaveBeenCalledWith(true);

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the global sidebar on Streamlined settings routes (sub-nav is page tabs)", async () => {
    currentPathname = "/PAP/company/settings/access";
    mockPluginSlots.slots = [
      {
        type: "page",
        id: "company-page",
        displayName: "Company Page",
        exportName: "CompanyPage",
        routePath: "company",
        pluginId: "plugin-1",
        pluginKey: "fake-plugin",
        pluginDisplayName: "Fake Plugin",
        pluginVersion: "1.0.0",
      },
      {
        type: "routeSidebar",
        id: "company-sidebar",
        displayName: "Company Route Sidebar",
        exportName: "CompanySidebar",
        routePath: "company",
        pluginId: "plugin-1",
        pluginKey: "fake-plugin",
        pluginDisplayName: "Fake Plugin",
        pluginVersion: "1.0.0",
      },
    ];
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    // Settings no longer mounts a contextual sidebar, and the peer column is
    // gone entirely (redesign ADDENDUM 2): no plugin routeSidebar renders
    // beside the global nav either.
    expect(container.textContent).not.toContain("Plugin route sidebar");
    expect(container.textContent).not.toContain("Company settings sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the global sidebar on legacy settings routes when Streamlined UI is off", async () => {
    currentPathname = "/PAP/company/settings/access";
    mockInstanceSettingsApi.getExperimental.mockResolvedValue({
      enableApps: true,
      enableStreamlinedUi: false,
    });
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("Company settings sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  it("renders a mobile company settings selector on company settings routes", async () => {
    currentPathname = "/PAP/company/settings/secrets";
    mockSidebarState.isMobile = true;
    mockSidebarState.sidebarOpen = false;
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    const selector = container.querySelector("select");
    expect(selector).not.toBeNull();
    expect(selector?.value).toBe("secrets");
    const selectorText = selector?.textContent?.toLowerCase() ?? "";
    expect(selectorText).toContain("general");
    expect(selectorText).toContain("export");
    expect(selectorText).toContain("import");
    expect(selectorText).toContain("members");
    // Invites live on a tab of the Members page now, so the selector no
    // longer carries a standalone entry for them.
    expect(selectorText).not.toContain("invites");
    expect(selectorText).toContain("secrets");
    expect(selectorText).toContain("profile");
    expect(selectorText).toContain("environments");
    expect(selectorText).toContain("plugins");
    expect(selectorText).not.toContain("instance general");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the company nav on instance settings routes", async () => {
    currentPathname = "/PAP/company/settings/instance/general";
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("Company settings sidebar");
    expect(container.textContent).not.toContain("Plugin route sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  it.each(["/PAP/company/export", "/PAP/company/import"])(
    "keeps the company nav on %s",
    async (pathname) => {
      currentPathname = pathname;
      const root = createRoot(container);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Layout />
          </QueryClientProvider>,
        );
      });
      await flushReact();
      await flushReact();

      expect(container.textContent).toContain("Main company nav");
      expect(container.textContent).not.toContain("Company settings sidebar");

      await act(async () => {
        root.unmount();
      });
    },
  );

  it("keeps the company nav on legacy tools routes", async () => {
    currentPathname = "/PAP/tools/runtime";
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("Apps sidebar");
    expect(container.textContent).not.toContain("Company settings sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  it("drops the Apps secondary sidebar regardless of the retired experimental flag", async () => {
    currentPathname = "/PAP/apps";
    mockInstanceSettingsApi.getExperimental.mockResolvedValue({
      enableApps: false,
    });
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("Apps sidebar");
    expect(container.querySelector("[data-secondary-sidebar]")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the global sidebar on the M8 advanced-setup tabs", async () => {
    currentPathname = "/PAP/apps/advanced/paste-config";
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).not.toContain("Apps sidebar");
    expect(container.textContent).toContain("Main company nav");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the global sidebar on legacy developer tabs behind the Advanced door", async () => {
    currentPathname = "/PAP/apps/advanced/runtime";
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).not.toContain("Apps sidebar");
    expect(container.textContent).toContain("Main company nav");

    await act(async () => {
      root.unmount();
    });
  });

  // Reserved Apps subroutes are not connection ids. They keep the global
  // sidebar and never mount a detail sidebar for a phantom app.
  it.each(["browse", "connections", "vercel-connect", "review", "chat"])(
    "keeps the global sidebar on the %s surface",
    async (route) => {
      currentPathname = `/PAP/apps/${route}`;
      const root = createRoot(container);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Layout />
          </QueryClientProvider>,
        );
      });
      await flushReact();
      await flushReact();

      expect(container.textContent).not.toContain("Apps sidebar");
      expect(container.textContent).toContain("Main company nav");
      expect(container.textContent).not.toContain("App detail sidebar");

      await act(async () => {
        root.unmount();
      });
    },
  );

  it("keeps the global sidebar on the gateways list and detail routes", async () => {
    for (const pathname of [
      "/PAP/apps/gateways",
      "/PAP/apps/gateways/gw-1/overview",
    ]) {
      currentPathname = pathname;
      const root = createRoot(container);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Layout />
          </QueryClientProvider>,
        );
      });
      await flushReact();
      await flushReact();

      expect(container.textContent).not.toContain("Apps sidebar");
      expect(container.textContent).toContain("Main company nav");
      expect(container.textContent).not.toContain("App detail sidebar");

      await act(async () => {
        root.unmount();
      });
    }
  });

  it("keeps the global sidebar on app connection detail routes", async () => {
    currentPathname = "/PAP/apps/conn-1/permissions";
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("App detail sidebar");
    expect(container.textContent).not.toContain("Apps sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the global sidebar on not-connected app routes", async () => {
    currentPathname = "/PAP/apps/app/app-1/permissions";
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("App detail sidebar");
    expect(container.textContent).not.toContain("Apps sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps Agent and Routine collection routes in global navigation", async () => {
    for (const pathname of [
      "/PAP/agents/all",
      "/PAP/agents/new",
      "/PAP/routines",
    ]) {
      currentPathname = pathname;
      const root = createRoot(container);
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <Layout />
          </QueryClientProvider>,
        );
      });
      await flushReact();
      await flushReact();

      expect(container.textContent).toContain("Main company nav");
      expect(container.textContent).not.toContain("Agent sidebar");
      expect(container.textContent).not.toContain("Routine sidebar");

      await act(async () => {
        root.unmount();
      });
      container.innerHTML = "";
    }
  });

  it("keeps the normal company sidebar when a plugin page route is ambiguous", async () => {
    currentPathname = "/PAP/wiki";
    mockPluginSlots.slots = [
      {
        type: "page",
        id: "wiki-page-a",
        displayName: "Wiki Page A",
        exportName: "WikiPageA",
        routePath: "wiki",
        pluginId: "plugin-1",
        pluginKey: "wiki-plugin-a",
        pluginDisplayName: "Wiki Plugin A",
        pluginVersion: "1.0.0",
      },
      {
        type: "page",
        id: "wiki-page-b",
        displayName: "Wiki Page B",
        exportName: "WikiPageB",
        routePath: "wiki",
        pluginId: "plugin-2",
        pluginKey: "wiki-plugin-b",
        pluginDisplayName: "Wiki Plugin B",
        pluginVersion: "1.0.0",
      },
      {
        type: "routeSidebar",
        id: "wiki-route-sidebar",
        displayName: "Wiki Sidebar",
        exportName: "WikiSidebar",
        routePath: "wiki",
        pluginId: "plugin-1",
        pluginKey: "wiki-plugin-a",
        pluginDisplayName: "Wiki Plugin A",
        pluginVersion: "1.0.0",
      },
    ];
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    expect(container.textContent).toContain("Main company nav");
    expect(container.textContent).not.toContain("Plugin route sidebar");

    await act(async () => {
      root.unmount();
    });
  });

  async function renderLayoutRoot(): Promise<{
    root: ReturnType<typeof createRoot>;
    rootEl: HTMLElement;
  }> {
    const root = createRoot(container);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    const rootEl = container.firstElementChild as HTMLElement;
    return { root, rootEl };
  }

  it("clips horizontal overflow on the mobile layout root so the viewport can't scroll sideways", async () => {
    mockSidebarState.isMobile = true;
    mockSidebarState.sidebarOpen = false;
    const { root, rootEl } = await renderLayoutRoot();

    expect(rootEl.tagName).toBe("DIV");
    expect(rootEl.className).toContain("bg-background");
    // The mobile root must clip horizontal overflow to prevent a stray wide
    // descendant from making the whole viewport scroll sideways. clip (not
    // hidden) keeps overflow-y visible so body scroll keeps working.
    expect(rootEl.classList.contains("overflow-x-clip")).toBe(true);
    expect(rootEl.classList.contains("overflow-hidden")).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("clips overflow on the desktop layout root", async () => {
    mockSidebarState.isMobile = false;
    const { root, rootEl } = await renderLayoutRoot();

    expect(rootEl.className).toContain("bg-background");
    expect(rootEl.classList.contains("overflow-clip")).toBe(true);

    await act(async () => {
      root.unmount();
    });
  });
});
