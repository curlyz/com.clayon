import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Paperclip native shell (antl single-frontend pattern): the Vite build is
 * bundled into the app — never server.url. The WebView origin is a stable,
 * brand-owned hostname so the deployed instance can allowlist it by exact
 * match (config `crossOriginApiOrigins` on the server).
 */
const config: CapacitorConfig = {
  appId: "com.paperclipai.mobile",
  appName: "Paperclip",
  webDir: "dist",
  backgroundColor: "#18181b", // matches the dark theme's first-paint background
  server: {
    // The brand hostname gives the shell its WebView origin:
    // capacitor://app.paperclip.curly.ng. WebKit refuses WKURLSchemeHandler
    // registration for standard schemes, so iosScheme "https" is ignored and
    // the origin scheme stays "capacitor" (verified on Gold in-sim,
    // 2026-09-26; the server allowlists this exact origin string). Android
    // keeps its default https scheme origin.
    hostname: "app.paperclip.curly.ng",
    androidScheme: "https",
  },
};

export default config;
