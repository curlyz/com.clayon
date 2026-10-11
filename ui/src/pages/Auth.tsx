import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Fingerprint } from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "@/api/auth";
import { authClient } from "@/api/authClient";
import { healthApi } from "@/api/health";
import { CloudSignIn } from "@/components/CloudSignIn";
import { clearCloudSignInAttempt } from "@/lib/cloud-sign-in";
import { tenantSignInReturnPath } from "@/lib/cloudLinks";
import { queryKeys } from "@/lib/queryKeys";
import { getRememberedInvitePath } from "@/lib/invite-memory";
import { Portal } from "@/components/portal/Portal";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [showSignIn, setShowSignIn] = useState(false);
  const entryAction = useRef<HTMLButtonElement>(null);
  const emailField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);
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
      setError(String(err).replace(/^Error:\s*/, "") || "Authentication failed");
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
      const message = String(err).replace(/^Error:\s*/, "");
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

  useEffect(() => {
    if (!showSignIn) return;
    if (mode === "sign_up") nameField.current?.focus();
    else emailField.current?.focus();
  }, [showSignIn, mode]);

  if (healthQuery.isLoading || isSessionLoading || session) {
    return (
      <Portal>
        <div className="halo-portal-content" role="status">
          <h1 className="halo-portal-title">Opening the portal.</h1>
          <p className="halo-portal-description">Checking your session…</p>
        </div>
      </Portal>
    );
  }

  // A health/session failure must not be mistaken for a self-hosted instance.
  if (healthQuery.error || sessionError) {
    return (
      <Portal>
        <div className="halo-portal-content">
          <h1 className="halo-portal-title">The portal is out of reach.</h1>
          <p role="alert" className="halo-portal-error">Unable to check sign-in. Try again to reconnect.</p>
          <button type="button" className="halo-portal-action" onClick={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.health });
            void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
          }}>Try again <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" /></button>
        </div>
      </Portal>
    );
  }

  if (healthQuery.data?.cloud) {
    return <CloudSignIn cloud={healthQuery.data.cloud} returnTo={nextPath} />;
  }

  if (!showSignIn) {
    return (
      <Portal>
        <div className="halo-portal-content">
          <p className="halo-portal-eyebrow">The lab / Portal 01</p>
          <h1 className="halo-portal-title">
            <span>Your mission.</span>
            <span className="halo-portal-title-accent">A new world.</span>
          </h1>
          <p className="halo-portal-description">Build an AI company. Give it a mission. Let your agents get to work.</p>
          <div className="halo-portal-actions">
            <button ref={entryAction} type="button" className="halo-portal-action" onClick={() => setShowSignIn(true)}>
              Enter Clayon <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" />
            </button>
            <p className="halo-portal-note">Meet the crew. Build what comes next.</p>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
        <div className="halo-portal-form">
          <p className="halo-portal-eyebrow">Step inside</p>
          <h1 className="halo-portal-title">
            {mode === "sign_in" ? "Sign in to Clayon" : "Create your Clayon account"}
          </h1>
          <p className="halo-portal-description">
            {mode === "sign_in"
              ? "Use your email and password to access this instance."
              : "Create an account to start building your AI company."}
          </p>

          <form
            className="halo-portal-field"
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
              <div className="halo-portal-field">
                <label htmlFor="name">Name</label>
                <input
                  ref={nameField}
                  id="name"
                  name="name"
                  className="halo-portal-input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
            )}
            <div className="halo-portal-field">
              <label htmlFor="email">Email</label>
              <input
                ref={emailField}
                id="email"
                name="email"
                className="halo-portal-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <div className="halo-portal-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                className="halo-portal-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
                minLength={mode === "sign_up" ? 8 : undefined}
                required
                aria-required="true"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            {error && (
              <p id={errorId} role="alert" className="halo-portal-error">
                {error}
              </p>
            )}
            <div className="halo-portal-form-footer">
              <button type="button" className="halo-portal-text-action" disabled={mutation.isPending} onClick={() => {
                setShowSignIn(false);
                requestAnimationFrame(() => entryAction.current?.focus());
              }}>Back</button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="halo-portal-action"
              >
                {mutation.isPending
                  ? "Working…"
                  : mode === "sign_in"
                    ? "Sign In"
                    : "Create Account"}
              </button>
            </div>
          </form>

          {googleEnabled || passkeyEnabled ? (
            <div className="halo-portal-field">
              {googleEnabled ? (
                <button
                  type="button"
                  className="halo-portal-secondary"
                  disabled={socialMutation.isPending}
                  aria-describedby={socialError ? socialErrorId : undefined}
                  onClick={() => socialMutation.mutate()}
                >
                  <ArrowUpRight aria-hidden="true" />
                  {socialMutation.isPending ? "Redirecting…" : "Continue with Google"}
                </button>
              ) : null}
              {passkeyEnabled ? (
                <button
                  type="button"
                  className="halo-portal-secondary"
                  disabled={passkeyMutation.isPending}
                  aria-describedby={passkeyError ? passkeyErrorId : undefined}
                  onClick={() => passkeyMutation.mutate()}
                >
                  <Fingerprint aria-hidden="true" />
                  {passkeyMutation.isPending ? "Waiting for your device…" : "Sign in with a passkey"}
                </button>
              ) : null}
              {socialError ? (
                <p id={socialErrorId} role="alert" className="halo-portal-error">
                  {socialError}
                </p>
              ) : null}
              {passkeyError ? (
                <p id={passkeyErrorId} role="alert" className="halo-portal-error">
                  {passkeyError}
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            className="halo-portal-text-action"
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              setMode(mode === "sign_in" ? "sign_up" : "sign_in");
            }}
          >
            {mode === "sign_in" ? "Create an account" : "Sign in"}
          </button>
        </div>
    </Portal>
  );
}
