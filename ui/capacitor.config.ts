import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Paperclip native shell (antl single-frontend pattern): the Vite build is
 * bundled into the app — never server.url. The WebView origin is a stable,
 * brand-owned https hostname so the deployed instance can allowlist it by
 * exact match (config `crossOriginApiOrigins` on the server).
 */
const config: CapacitorConfig = {
  appId: "com.paperclipai.mobile",
  appName: "Paperclip",
  webDir: "dist",
  backgroundColor: "#18181b", // matches the dark theme's first-paint background
  server: {
    // Stable WebView origin: https://app.paperclip.curly.ng — allowlisted on
    // the server (compose env) for credentialed cross-origin API calls.
    hostname: "app.paperclip.curly.ng",
    iosScheme: "https",
    androidScheme: "https",
  },
};

export default config;
