import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Clayon native shell (antl single-frontend pattern): the Vite build is
 * bundled into the app — never server.url. The WebView origin is a stable,
 * brand-owned hostname so the deployed instance can allowlist it by exact
 * match (config `crossOriginApiOrigins` on the server).
 */
const config: CapacitorConfig = {
  appId: "com.clayon.mobile",
  appName: "Clayon",
  webDir: "dist",
  backgroundColor: "#18181b", // matches the dark theme's first-paint background
  server: {
    // The brand hostname gives the shell its WebView origin:
    // capacitor://clayon.app on iOS (WebKit refuses WKURLSchemeHandler
    // registration for standard schemes, so iosScheme "https" is ignored —
    // verified on Gold in-sim, 2026-09-26) and https://clayon.app on
    // Android. Both origin strings are allowlisted server-side. The iOS
    // hostname is WebView-internal only — it never resolves in DNS.
    hostname: "clayon.app",
    androidScheme: "https",
  },
};

export default config;
