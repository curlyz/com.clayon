import * as React from "react";
import { StrictMode } from "react";
import * as ReactDOM from "react-dom";
import { BrowserRouter, HashRouter } from "@/lib/router";
import { Capacitor } from "@capacitor/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { SentryGate } from "./components/SentryGate";
import { CompanyProvider, useCompany } from "./context/CompanyContext";
import { LiveUpdatesProvider } from "./context/LiveUpdatesProvider";
import { BreadcrumbProvider } from "./context/BreadcrumbContext";
import { PanelProvider } from "./context/PanelContext";
import { SidebarProvider } from "./context/SidebarContext";
import { DialogProvider } from "./context/DialogContext";
import { EditorAutocompleteProvider } from "./context/EditorAutocompleteContext";
import { PrimaryAgentProvider } from "./context/PrimaryAgentProvider";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ReadingFontProvider } from "./context/ReadingFontContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initPluginBridge } from "./plugins/bridge-init";
import { PluginLauncherProvider } from "./plugins/launchers";
import { startPerfMeasureReaper } from "./lib/perf-measure-reaper";
import { getOrCreatePaperclipReactRoot } from "./lib/react-root";
import { startServiceWorkerUpdates } from "./lib/service-worker-updates";
import "@mdxeditor/editor/style.css";
import "./index.css";

initPluginBridge(React, ReactDOM);

// React 19.2 emits an unbounded stream of performance.measure() entries for its
// DevTools performance tracks and never clears them; on a long-lived tab they
// accumulate into millions of native objects (GBs). Reap them periodically.
startPerfMeasureReaper();

// Parked SPA tabs never navigate, so beyond registering the worker this also
// re-checks /sw.js on tab focus and hourly, and applies a discovered update
// with one reload while the tab is hidden — otherwise an old worker and its
// cached shell can outlive a deploy indefinitely.
window.addEventListener("load", () => {
  // The native shell bundles its assets; there is no /sw.js at its WebView
  // origin, so update polling stays a browser-only concern.
  if (!Capacitor.isNativePlatform()) {
    startServiceWorkerUpdates();
  }
});

// The native shell has no server to answer path routes on reload, so it uses
// hash history; the browser keeps clean paths.
const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Explicit so cross-tab-published cache entries for resources this tab
      // isn't observing get collected promptly rather than lingering. Single
      // tuning point if we need to trim the cache footprint further.
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
    },
  },
});

function CompanyAwareBreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const { selectedCompany } = useCompany();
  return <BreadcrumbProvider companyName={selectedCompany?.name ?? null}>{children}</BreadcrumbProvider>;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Paperclip root element is missing");

getOrCreatePaperclipReactRoot(window, rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SentryGate />
        <ThemeProvider>
          <ReadingFontProvider>
          {/* The native shell has no server to answer path routes on reload,
              so it uses hash history; the browser keeps clean paths. */}
          <AppRouter>
            <CompanyProvider>
              <EditorAutocompleteProvider>
                <ToastProvider>
                  <PrimaryAgentProvider>
                  <LiveUpdatesProvider>
                    <TooltipProvider>
                      <CompanyAwareBreadcrumbProvider>
                        <SidebarProvider>
                          <PanelProvider>
                            <PluginLauncherProvider>
                              <DialogProvider>
                                <App />
                              </DialogProvider>
                            </PluginLauncherProvider>
                          </PanelProvider>
                        </SidebarProvider>
                      </CompanyAwareBreadcrumbProvider>
                    </TooltipProvider>
                  </LiveUpdatesProvider>
                  </PrimaryAgentProvider>
                </ToastProvider>
              </EditorAutocompleteProvider>
            </CompanyProvider>
          </AppRouter>
          </ReadingFontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>
);
