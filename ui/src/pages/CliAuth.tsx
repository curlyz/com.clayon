import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";

export function CliAuthPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const challengeId = (params.id ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();
  const currentPath = useMemo(
    () => `/cli-auth/${encodeURIComponent(challengeId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    [challengeId, token],
  );

  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const challengeQuery = useQuery({
    queryKey: ["cli-auth-challenge", challengeId, token],
    queryFn: () => accessApi.getCliAuthChallenge(challengeId, token),
    enabled: challengeId.length > 0 && token.length > 0,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: () => accessApi.approveCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await challengeQuery.refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => accessApi.cancelCliAuthChallenge(challengeId, token),
    onSuccess: async () => {
      await challengeQuery.refetch();
    },
  });

  if (!challengeId || !token) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">Invalid CLI auth URL.</div>;
  }

  if (sessionQuery.isLoading || challengeQuery.isLoading) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Loading CLI auth challenge...</div>;
  }

  if (challengeQuery.error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col">
        <section className="border-t border-border">
          <h1 className="bg-muted/50 px-4 py-3 text-lg font-semibold">CLI auth challenge unavailable</h1>
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            {challengeQuery.error instanceof Error ? challengeQuery.error.message : "Challenge is invalid or expired."}
          </p>
        </section>
      </div>
    );
  }

  const challenge = challengeQuery.data;
  if (!challenge) {
    return <div className="mx-auto max-w-xl py-10 text-sm text-destructive">CLI auth challenge unavailable.</div>;
  }

  if (challenge.status === "approved") {
    return (
      <div className="mx-auto flex max-w-xl flex-col">
        <section className="border-t border-border">
          <h1 className="bg-muted/50 px-4 py-3 text-xl font-semibold">CLI access approved</h1>
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            The Paperclip CLI can now finish authentication on the requesting machine.
          </p>
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            Command: <span className="font-mono text-foreground">{challenge.command}</span>
          </p>
        </section>
      </div>
    );
  }

  if (challenge.status === "cancelled" || challenge.status === "expired") {
    return (
      <div className="mx-auto flex max-w-xl flex-col">
        <section className="border-t border-border">
          <h1 className="bg-muted/50 px-4 py-3 text-xl font-semibold">
            {challenge.status === "expired" ? "CLI auth challenge expired" : "CLI auth challenge cancelled"}
          </h1>
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            Start the CLI auth flow again from your terminal to generate a new approval request.
          </p>
        </section>
      </div>
    );
  }

  if (challenge.requiresSignIn || !sessionQuery.data) {
    return (
      <div className="mx-auto flex max-w-xl flex-col">
        <section className="border-t border-border">
          <h1 className="bg-muted/50 px-4 py-3 text-xl font-semibold">Sign in required</h1>
          <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
            Sign in or create an account, then return to this page to approve the CLI access request.
          </p>
          <div className="flex items-center justify-end border-t border-border px-4 py-3">
            <Button asChild>
              <Link to={`/auth?next=${encodeURIComponent(currentPath)}`}>Sign in / Create account</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col">
      <section className="border-t border-border">
        <h1 className="bg-muted/50 px-4 py-3 text-xl font-semibold">Approve Paperclip CLI access</h1>
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          A local Paperclip CLI process is requesting board access to this instance.
        </p>

        <dl className="grid text-sm md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1 border-t border-border">
            <dt className="px-4 pt-3 text-muted-foreground">Command</dt>
            <dd className="break-words px-4 pb-3 font-mono text-foreground">{challenge.command}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1 border-t border-border">
            <dt className="px-4 pt-3 text-muted-foreground">Client</dt>
            <dd className="break-words px-4 pb-3 text-foreground">{challenge.clientName ?? "paperclipai cli"}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-1 border-t border-border">
            <dt className="px-4 pt-3 text-muted-foreground">Requested access</dt>
            <dd className="px-4 pb-3 text-foreground">
              {challenge.requestedAccess === "instance_admin_required" ? "Instance admin" : "Board"}
            </dd>
          </div>
          {challenge.requestedCompanyName && (
            <div className="flex min-w-0 flex-col gap-1 border-t border-border">
              <dt className="px-4 pt-3 text-muted-foreground">Requested organization</dt>
              <dd className="break-words px-4 pb-3 text-foreground">{challenge.requestedCompanyName}</dd>
            </div>
          )}
        </dl>

        {(approveMutation.error || cancelMutation.error) && (
          <p className="border-t border-border px-4 py-3 text-sm text-destructive">
            {(approveMutation.error ?? cancelMutation.error) instanceof Error
              ? ((approveMutation.error ?? cancelMutation.error) as Error).message
              : "Failed to update CLI auth challenge"}
          </p>
        )}

        {!challenge.canApprove && (
          <p className="border-t border-border px-4 py-3 text-sm text-destructive">
            This challenge requires instance-admin access. Sign in with an instance admin account to approve it.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={approveMutation.isPending || cancelMutation.isPending}
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel"}
          </Button>
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={!challenge.canApprove || approveMutation.isPending || cancelMutation.isPending}
          >
            {approveMutation.isPending ? "Approving..." : "Approve CLI access"}
          </Button>
        </div>
      </section>
    </div>
  );
}
