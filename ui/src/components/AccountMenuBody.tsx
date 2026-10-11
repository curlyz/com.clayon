import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, KeyRound, LogOut, Settings, UserPlus, type LucideIcon } from "lucide-react";
import { hidesCompanyPage, type DeploymentMode } from "@clayon/shared";
import { Link } from "@/lib/router";
import { authApi } from "@/api/auth";
import { authClient } from "@/api/authClient";
import { healthApi } from "@/api/health";
import { queryKeys } from "@/lib/queryKeys";
import { useCloudInstance } from "@/hooks/useCloudInstance";
import { useCloudInviteUrl } from "@/hooks/useCloudInviteUrl";
import { useCanInviteCompanyMembers } from "@/hooks/useCompanyInviteAccess";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { useSignOut } from "@/hooks/useSignOut";
import { useStagingCommit } from "@/hooks/useStagingCommit";
import { userProfilePath } from "@/lib/userProfileLinks";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { FontPicker } from "./FontPicker";
import { ThemeToggle } from "./ThemeToggle";
import { SidebarServerInfo } from "./SidebarServerInfo";

const INVITES_PATH = "/company/settings/members?tab=invites";
const DOCS_URL = "https://docs.clayon.ing/";

/*
 * The shared account menu body (2026-10-11 redesign): one header and one
 * action-rows block rendered by every account surface — the dock's You
 * popover (DockYouPanel) and the sidebar's account footer
 * (SidebarAccountMenu). Each surface composes them in its own popover and
 * may interleave its own rows (the dock's nav layout selector) between the
 * header and the rows.
 */

export function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

interface MenuActionProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  /** Opens `href` in a new tab (docs and other off-product links). */
  external?: boolean;
  /**
   * Leaves the app in the current tab with a full navigation. Cloud links
   * must use this: the cloud harness shadows those paths on tenant hosts.
   */
  topLevel?: boolean;
}

const menuActionClass =
  "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent";

function MenuAction({ label, icon: Icon, onClick, href, external = false, topLevel = false }: MenuActionProps) {
  const content = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={menuActionClass} onClick={onClick}>
          {content}
        </a>
      );
    }
    if (topLevel) {
      return (
        <a href={href} className={menuActionClass} onClick={onClick}>
          {content}
        </a>
      );
    }
    return (
      <Link to={href} className={menuActionClass} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={menuActionClass} onClick={onClick}>
      {content}
    </button>
  );
}

/** The account header: avatar, display name, email, staging SHA, profile link. */
export function AccountMenuHeader({ close }: { close: () => void }) {
  const stagingCommit = useStagingCommit(true);
  const { data: session } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const displayName = session?.user.name?.trim() || "Board";
  const initials = deriveInitials(displayName);
  const profileHref = userProfilePath(session?.user);

  return (
    // The profile link is a stretched overlay so the staging SHA anchor can
    // sit beside the email without nesting anchors.
    <div className="relative flex h-(--profile-popover-header-height) shrink-0 items-center gap-2.5 px-3.5">
      <Link
        to={profileHref}
        aria-label="View profile"
        onClick={close}
        className="absolute inset-0 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
      <Avatar className="pointer-events-none relative size-9">
        {session?.user.image ? <AvatarImage src={session.user.image} alt={displayName} /> : null}
        <AvatarFallback className="text-xs text-foreground">{initials}</AvatarFallback>
      </Avatar>
      <div className="pointer-events-none relative min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold leading-(--profile-popover-label-line-height) text-foreground">
          {displayName}
        </h2>
        <p className="truncate text-(length:--text-micro) leading-(--profile-popover-meta-line-height) text-muted-foreground">
          {session?.user.email?.trim() || "Local workspace board"}
        </p>
        {stagingCommit ? (
          <a
            className="pointer-events-auto block truncate font-mono text-(length:--text-micro) leading-(--profile-popover-meta-line-height) text-muted-foreground hover:underline focus-visible:underline"
            href={`https://github.com/clayon/clayon/commit/${stagingCommit}`}
            target="_blank"
            rel="noreferrer"
            aria-label={`View commit ${stagingCommit} on GitHub`}
            title={stagingCommit}
          >
            SHA {stagingCommit.slice(0, 7)}
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** The account action rows: settings, invite, docs, theme, font, sign out, server info. */
export function AccountMenuRows({ deploymentMode, close }: { deploymentMode?: DeploymentMode; close: () => void }) {
  const cloud = useCloudInstance();
  const isCloud = Boolean(cloud);
  // Invites live on the Members page (or in Cloud's People settings). Hide the
  // shortcut when the hosting operator hides either surface, and until the
  // health response resolves so a hidden surface never flashes.
  const { hidden: hiddenSettings, loaded: hiddenSettingsLoaded } = useHiddenSettings();
  // On Cloud the shortcut exists only for the current stack's owner/admin and
  // only once the stack metadata is known; the in-app Invites tab is never a
  // fallback there because it drives a different invitation flow.
  const cloudInviteUrl = useCloudInviteUrl();
  // Self-hosted invites need the `users:invite` grant. Offer the shortcut only
  // to boards with role-default access; the server checks the actual grants.
  const canInviteMembers = useCanInviteCompanyMembers(!isCloud);
  const inviteHref = isCloud ? cloudInviteUrl : canInviteMembers ? INVITES_PATH : null;
  const showInvite =
    hiddenSettingsLoaded &&
    inviteHref !== null &&
    !hidesCompanyPage(hiddenSettings, "company.members") &&
    !hidesCompanyPage(hiddenSettings, "company.invites");
  const signOutMutation = useSignOut({ onSignedOut: close });
  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });
  const passkeyEnabled = health?.authPasskey === true;
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const addPasskeyMutation = useMutation({
    // The native WebAuthn prompt takes over from the click; the menu stays
    // open so the outcome is visible where the action started.
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey();
      if (!result.data) {
        throw new Error(result.error?.message || "Passkey registration did not complete.");
      }
    },
    onSuccess: () => setPasskeyError(null),
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      // WebAuthn aborts (user cancelled / timed out) are expected, not errors.
      setPasskeyError(
        message.includes("NotAllowedError") || message.includes("abort")
          ? null
          : message || "Passkey registration failed",
      );
    },
  });

  return (
    <>
      <MenuAction label="Settings" icon={Settings} href="/company/settings" onClick={close} />
      {showInvite && inviteHref ? (
        <MenuAction label="Invite" icon={UserPlus} href={inviteHref} topLevel={isCloud} onClick={close} />
      ) : null}
      {passkeyEnabled ? (
        <button
          type="button"
          className={menuActionClass}
          disabled={addPasskeyMutation.isPending}
          onClick={() => addPasskeyMutation.mutate()}
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            <KeyRound className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {addPasskeyMutation.isPending
              ? addPasskeyMutation.isSuccess
                ? "Passkey added"
                : "Waiting for your device…"
              : "Add a passkey"}
          </span>
        </button>
      ) : null}
      {passkeyEnabled && passkeyError ? (
        <p role="alert" className="px-2.5 pb-1 text-(length:--text-micro) text-destructive">
          {passkeyError}
        </p>
      ) : null}
      {passkeyEnabled && addPasskeyMutation.isSuccess && !passkeyError ? (
        <p className="px-2.5 pb-1 text-(length:--text-micro) text-muted-foreground">
          Passkey saved to this account.
        </p>
      ) : null}
      <MenuAction label="Documentation" icon={BookOpen} href={DOCS_URL} external onClick={close} />
      <ThemeToggle variant="compact-menu-action" onAfterToggle={close} />
      <FontPicker onAfterChange={close} />
      {deploymentMode === "authenticated" ? (
        <button
          type="button"
          className={cn(
            "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-destructive/10",
            signOutMutation.isPending && "cursor-not-allowed opacity-60",
          )}
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            <LogOut className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate">
            {signOutMutation.isPending ? "Signing out..." : "Sign out"}
          </span>
        </button>
      ) : null}
      <SidebarServerInfo />
    </>
  );
}
