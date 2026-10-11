import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Better Auth browser client, used only for the flows that need Better Auth's
 * own client machinery (the passkey/WebAuthn ceremonies). Everything else in
 * this app talks to /api/auth through the hand-rolled `authApi` fetch layer —
 * same-origin by default, so no baseURL is needed.
 */
export const authClient = createAuthClient({
  plugins: [passkeyClient()],
});
