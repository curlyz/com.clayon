import { ArrowUpRight } from "lucide-react";
import type { CloudInstanceHealthStatus } from "@/api/health";
import { cloudStackEntryUrl } from "@/lib/cloudLinks";
import { clearCloudSignInAttempt } from "@/lib/cloud-sign-in";
import { Portal } from "@/components/portal/Portal";

export function CloudSignIn({ cloud, returnTo }: { cloud: CloudInstanceHealthStatus; returnTo: string }) {
  const entryUrl = cloudStackEntryUrl(cloud.cloudBaseUrl, cloud.stackSlug, returnTo);
  return (
    <Portal>
      <div className="halo-portal-content">
        <p className="halo-portal-eyebrow">The lab / Portal 01</p>
        <h1 className="halo-portal-title">
          <span>Your mission.</span>
          <span className="halo-portal-title-accent">A new world.</span>
        </h1>
        <p className="halo-portal-description">Build an AI company. Give it a mission. Let your agents get to work.</p>
        {entryUrl ? (
          <div className="halo-portal-actions">
            <a className="halo-portal-action" href={entryUrl} onClick={clearCloudSignInAttempt}>
              Enter Clayon <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" />
            </a>
            <p className="halo-portal-note">Continue securely with Clayon Cloud.</p>
          </div>
        ) : (
          <p role="alert" className="halo-portal-error">Cloud sign-in is unavailable for this workspace. Please contact your administrator.</p>
        )}
      </div>
    </Portal>
  );
}
