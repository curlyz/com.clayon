import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Navigate, Outlet, useLocation } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accessApi } from "@/api/access";
import { ApiError } from "@/api/client";
import { authApi } from "@/api/auth";
import { healthApi } from "@/api/health";
import { isTemporaryApiError } from "@/api/response";
import { queryKeys } from "@/lib/queryKeys";
import { BootstrapPendingPage } from "@/components/BootstrapPendingPage";
import { ClayonLockup } from "@/components/ClayonLockup";
import { CloudSignIn } from "@/components/CloudSignIn";
import { Portal } from "@/components/portal/Portal";
import { clearCloudSignInAttempt } from "@/lib/cloud-sign-in";

const RECONNECT_INTERVAL_MS = 5_000;

export function CloudAccessError({
  temporary,
  retrying,
  onRetry,
}: {
  temporary: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Portal>
      <div className="halo-portal-content" role="status">
        <h1 className="halo-portal-title">
          {temporary ? "Reconnecting to Clayon" : "Unable to load Clayon"}
        </h1>
        <p className="halo-portal-description">
          {temporary
            ? "The server may be restarting or your connection was interrupted. We’ll try again every few seconds and reconnect automatically."
            : "We couldn’t check your access to this instance. Try again, or contact your instance administrator if this continues."}
        </p>
        <button type="button" className="halo-portal-action" onClick={onRetry} disabled={retrying}>
          {retrying ? "Connecting…" : "Try again"}
          <RefreshCw className="halo-portal-action-icon" aria-hidden="true" />
        </button>
      </div>
    </Portal>
  );
}

function NoBoardAccessPage() {
  return (
    <Portal>
      <div className="halo-portal-content">
        <h1 className="halo-portal-title">No organization access</h1>
        <p className="halo-portal-description">
          This account is signed in, but it does not have an active organization membership or instance-admin access on
          this Clayon instance.
        </p>
        <p className="halo-portal-note">
          Use an organization invite or sign in with an account that already belongs to this org.
        </p>
      </div>
    </Portal>
  );
}

export function CloudAccessGate({ allowMembershipRequest = false }: { allowMembershipRequest?: boolean } = {}) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [hasOpenedBoard, setHasOpenedBoard] = useState(false);
  const healthQuery = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
    refetchInterval: (query) => {
      if (query.state.error) return isTemporaryApiError(query.state.error) ? RECONNECT_INTERVAL_MS : false;
      const data = query.state.data;
      if (data?.status === "starting") return RECONNECT_INTERVAL_MS;
      return data?.deploymentMode === "authenticated" && data.bootstrapStatus === "bootstrap_pending"
        ? 2000
        : false;
    },
    refetchIntervalInBackground: true,
  });

  const isAuthenticatedMode = healthQuery.data?.deploymentMode === "authenticated";
  const isBootstrapPending = isAuthenticatedMode && healthQuery.data?.bootstrapStatus === "bootstrap_pending";
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    enabled: isAuthenticatedMode,
    retry: false,
    refetchInterval: (query) => isTemporaryApiError(query.state.error) ? RECONNECT_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (sessionQuery.data) clearCloudSignInAttempt();
  }, [sessionQuery.data]);

  const boardAccessQuery = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
    enabled: isAuthenticatedMode && !isBootstrapPending && !!sessionQuery.data,
    retry: false,
    refetchInterval: (query) => isTemporaryApiError(query.state.error) ? RECONNECT_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
  });
  const claimMutation = useMutation({
    mutationFn: () => accessApi.claimBootstrapAdmin(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.health });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.stats });
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.currentBoardAccess });
    },
  });

  const activeQueries = [
    healthQuery,
    ...(isAuthenticatedMode ? [sessionQuery] : []),
    ...(isAuthenticatedMode && !isBootstrapPending && sessionQuery.data ? [boardAccessQuery] : []),
  ];
  const isServerStarting = healthQuery.data?.status === "starting";
  const isReconnecting = isServerStarting || activeQueries.some((query) => isTemporaryApiError(query.error));
  // A background outage must not unmount editors and discard drafts. Cached
  // access is only retained for transport failures; 401/403 still fail closed.
  const blockingError = activeQueries.find((query) => query.error
    && !(query.data !== undefined && isTemporaryApiError(query.error)))?.error;
  const isLoading =
    healthQuery.isLoading ||
    (isAuthenticatedMode && sessionQuery.isLoading) ||
    (isAuthenticatedMode && !isBootstrapPending && !!sessionQuery.data && boardAccessQuery.isLoading);
  const hasBoardAccess = allowMembershipRequest || !isAuthenticatedMode
    || !!boardAccessQuery.data?.isInstanceAdmin || (boardAccessQuery.data?.companyIds.length ?? 0) > 0;
  const canAccessBoard = !isLoading && !blockingError && !isBootstrapPending
    && (!isAuthenticatedMode || !!sessionQuery.data) && hasBoardAccess;
  useEffect(() => {
    if (!canAccessBoard) setHasOpenedBoard(false);
    else if (healthQuery.data?.status === "ok") setHasOpenedBoard(true);
  }, [canAccessBoard, healthQuery.data?.status]);
  const wasReconnecting = useRef(false);
  useEffect(() => {
    if (isReconnecting) {
      wasReconnecting.current = true;
    } else if (wasReconnecting.current && !isLoading && !blockingError) {
      wasReconnecting.current = false;
      // Other reads (including the company list) may have failed during boot.
      // Refresh those too so recovery does not strand the user on a second error.
      void queryClient.invalidateQueries({ predicate: (query) => isTemporaryApiError(query.state.error) });
    }
  }, [isReconnecting, isLoading, blockingError, queryClient]);

  if (blockingError || (isServerStarting && !hasOpenedBoard)) {
    return (
      <CloudAccessError
        temporary={blockingError ? isTemporaryApiError(blockingError) : true}
        retrying={activeQueries.some((query) => query.isFetching)}
        onRetry={() => {
          for (const query of activeQueries) {
            if (query.error || (query === healthQuery && isServerStarting)) {
              void query.refetch({ cancelRefetch: false });
            }
          }
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <Portal>
        <div className="halo-portal-content" role="status">
          <h1 className="halo-portal-title">Opening the portal.</h1>
          <p className="halo-portal-description">Checking your access…</p>
        </div>
      </Portal>
    );
  }

  if (isAuthenticatedMode && healthQuery.data?.cloud && !sessionQuery.data) {
    return <CloudSignIn cloud={healthQuery.data.cloud} returnTo={`${location.pathname}${location.search}${location.hash}`} />;
  }

  if (isBootstrapPending) {
    const health = healthQuery.data;
    if (!health) {
      return <ClayonLockup className="text-lg" />;
    }
    const claimError = claimMutation.error instanceof ApiError
      ? { status: claimMutation.error.status, message: claimMutation.error.message }
      : claimMutation.error instanceof Error
        ? { message: claimMutation.error.message }
        : null;
    return (
      <BootstrapPendingPage
        claimAvailable={health.deploymentExposure === "private"}
        hasActiveInvite={health.bootstrapInviteActive}
        session={sessionQuery.data}
        claimState={claimMutation.isSuccess ? "success" : claimMutation.isPending ? "claiming" : "idle"}
        claimError={claimError}
        onClaim={() => claimMutation.mutate()}
      />
    );
  }

  if (isAuthenticatedMode && !sessionQuery.data) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  // Private invitation pages may let signed-in nonmembers request access.
  // Their token APIs still enforce membership before granting any authority.
  if (!hasBoardAccess) {
    return <NoBoardAccessPage />;
  }

  return (
    <>
      {isReconnecting && (
        <div role="status" className="bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
          Connection interrupted. Reconnecting automatically…
        </div>
      )}
      <Outlet />
    </>
  );
}
