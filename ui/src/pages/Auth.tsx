import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint } from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { authClient } from "../api/authClient";
import { healthApi } from "../api/health";
import { CloudSignIn } from "@/components/CloudSignIn";
import { clearCloudSignInAttempt } from "@/lib/cloud-sign-in";
import { tenantSignInReturnPath } from "@/lib/cloudLinks";
import { queryKeys } from "../lib/queryKeys";
import { getRememberedInvitePath } from "../lib/invite-memory";
import { Button } from "@/components/ui/button";
import { GoogleMark } from "@/components/GoogleMark";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { ClayonLockup } from "@/components/ClayonLockup";
import { ThemeToggle } from "@/components/ThemeToggle";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = "auth-error";

  const nextPath = useMemo(
    () => tenantSignInReturnPath(searchParams.get("next") || getRememberedInvitePath() || "/"),
    [searchParams],
  );
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });
  const { data: session, isLoading: isSessionLoading, error: sessionError } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      clearCloudSignInAttempt();
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      // Reset rather than invalidate: the `["companies"]` entry is shared app-wide and
      // is not account-scoped, so invalidating leaves the previous account's list
      // readable (and any fetch for that session in flight) until the refetch lands.
      // Sign-in can change accounts, so drop the list outright.
      await queryClient.resetQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Authentication failed");
    },
  });

  const googleEnabled = (healthQuery.data?.authSocialProviders ?? []).includes("google");
  const [socialError, setSocialError] = useState<string | null>(null);
  const socialErrorId = "auth-social-error";
  const socialMutation = useMutation({
    mutationFn: () => authApi.signInSocial({ provider: "google", callbackURL: nextPath }),
    onError: (err) => {
      setSocialError(String(err).replace(/^Error:\s*/, "") || "Google sign-in failed");
    },
  });

  const passkeyEnabled = healthQuery.data?.authPasskey === true;
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const passkeyErrorId = "auth-passkey-error";
  const passkeyMutation = useMutation({
    mutationFn: async () => {
      // Results always come back as a data object (throw never fires here).
      const result = await authClient.signIn.passkey();
      if (!result.data) {
        throw new Error(result.error?.message || "Passkey sign-in did not return a session.");
      }
    },
    onSuccess: async () => {
      setPasskeyError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      // WebAuthn aborts (user cancelled / timed out) are expected, not errors.
      const message = err instanceof Error ? err.message : String(err);
      setPasskeyError(
        message.includes("NotAllowedError") || message.includes("abort")
          ? null
          : message || "Passkey sign-in failed",
      );
    },
  });

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  if (healthQuery.isLoading || isSessionLoading || session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <ClayonLockup className="text-lg" />
      </div>
    );
  }

  // A health/session failure must not be mistaken for a self-hosted instance.
  if (healthQuery.error || sessionError) {
    return <p role="alert" className="p-6 text-sm text-destructive">Unable to check sign-in. Refresh and try again.</p>;
  }

  if (healthQuery.data?.cloud) {
    return <CloudSignIn cloud={healthQuery.data.cloud} returnTo={nextPath} />;
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* Left half — form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div className="mb-8">
            <ClayonLockup className="text-lg" />
          </div>

          <h1 className="text-xl font-semibold">
            {mode === "sign_in" ? "Sign in to Clayon" : "Create your Clayon account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Use your email and password to access this instance."
              : "Create an account for this instance. Email confirmation is not required in v1."}
          </p>

          <form
            className="mt-6 space-y-4"
            method="post"
            action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
            onSubmit={(event) => {
              event.preventDefault();
              if (mutation.isPending) return;
              if (!canSubmit) {
                setError("Please fill in all required fields.");
                return;
              }
              mutation.mutate();
            }}
          >
            {mode === "sign_up" && (
              <div>
                <label htmlFor="name" className="text-xs text-muted-foreground mb-1 block">Name</label>
                <input
                  id="name"
                  name="name"
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  autoFocus
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="text-xs text-muted-foreground mb-1 block">Email</label>
              <input
                id="email"
                name="email"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                autoFocus={mode === "sign_in"}
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs text-muted-foreground mb-1 block">Password</label>
              <input
                id="password"
                name="password"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            {error && (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending}
              aria-disabled={!canSubmit || mutation.isPending}
              className={`w-full ${!canSubmit && !mutation.isPending ? "opacity-50" : ""}`}
            >
              {mutation.isPending
                ? "Working…"
                : mode === "sign_in"
                  ? "Sign In"
                  : "Create Account"}
            </Button>
          </form>

          {googleEnabled || passkeyEnabled ? (
            <div className="mt-6 space-y-2 border-t border-border pt-6">
              {googleEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={socialMutation.isPending}
                  aria-describedby={socialError ? socialErrorId : undefined}
                  onClick={() => socialMutation.mutate()}
                >
                  <GoogleMark className="mr-2" />
                  {socialMutation.isPending ? "Redirecting…" : "Continue with Google"}
                </Button>
              ) : null}
              {passkeyEnabled ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={passkeyMutation.isPending}
                  aria-describedby={passkeyError ? passkeyErrorId : undefined}
                  onClick={() => passkeyMutation.mutate()}
                >
                  <Fingerprint className="mr-2 size-4" />
                  {passkeyMutation.isPending ? "Waiting for your device…" : "Sign in with a passkey"}
                </Button>
              ) : null}
              {socialError ? (
                <p id={socialErrorId} role="alert" className="mt-2 text-xs text-destructive">
                  {socialError}
                </p>
              ) : null}
              {passkeyError ? (
                <p id={passkeyErrorId} role="alert" className="mt-2 text-xs text-destructive">
                  {passkeyError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 text-sm text-muted-foreground">
            {mode === "sign_in" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
              onClick={() => {
                setError(null);
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              }}
            >
              {mode === "sign_in" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
      </div>

      {/* Right half — ASCII art animation (hidden on mobile) */}
      <div className="hidden md:block w-1/2 overflow-hidden">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}
