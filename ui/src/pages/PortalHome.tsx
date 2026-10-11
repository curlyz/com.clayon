import { ArrowUpRight } from "lucide-react";
import { Portal } from "@/components/portal/Portal";
import { useCompany } from "@/context/CompanyContext";
import { useCloudInstance } from "@/hooks/useCloudInstance";
import { cloudStackCreateUrl } from "@/lib/cloudLinks";
import { Link } from "@/lib/router";

/** The protected root entry. Company pages retain their existing routes and shell. */
export function PortalHome() {
  const { companies, selectedCompany, loading, companyListUnavailable, retryCompanies } = useCompany();
  const cloudInstance = useCloudInstance();
  const createStackUrl = cloudStackCreateUrl(cloudInstance?.cloudBaseUrl);
  const company = selectedCompany ?? companies[0] ?? null;

  if (loading) {
    return (
      <Portal>
        <div className="halo-portal-content" role="status">
          <h1 className="halo-portal-title">Opening your world.</h1>
          <p className="halo-portal-description">Finding your organizations…</p>
        </div>
      </Portal>
    );
  }

  if (companyListUnavailable) {
    return (
      <Portal>
        <div className="halo-portal-content">
          <h1 className="halo-portal-title">Your world is out of reach.</h1>
          <p className="halo-portal-error" role="alert">We couldn’t load your organizations. Try again to reconnect.</p>
          <button type="button" className="halo-portal-action" onClick={() => void retryCompanies()}>
            Try again <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" />
          </button>
        </div>
      </Portal>
    );
  }

  return (
    <Portal detail={company ? company.name : "Built around your mission."}>
      <div className="halo-portal-content">
        <p className="halo-portal-eyebrow">{company ? "Welcome back / The lab" : "The lab / Portal 01"}</p>
        <h1 className="halo-portal-title">
          <span>Your mission.</span>
          {" "}
          <span className="halo-portal-title-accent">{company ? "Ready when you are." : "A new world."}</span>
        </h1>
        <p className="halo-portal-description">
          {company
            ? `Step into ${company.name}. Your agents, tasks, and decisions are waiting.`
            : "Build an AI company. Give it a mission. Let your agents get to work."}
        </p>
        <div className="halo-portal-actions">
          {company ? (
            <Link className="halo-portal-action" to={`/${company.issuePrefix}/dashboard`}>
              Open dashboard <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" />
            </Link>
          ) : cloudInstance ? (
            createStackUrl ? (
              <a className="halo-portal-action" href={createStackUrl}>
                Create an organization <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" />
              </a>
            ) : (
              <p className="halo-portal-error" role="alert">Organization creation is unavailable. Open your Clayon Cloud portfolio to try again.</p>
            )
          ) : (
            <Link className="halo-portal-action" to="/onboarding">
              Create an organization <ArrowUpRight className="halo-portal-action-icon" aria-hidden="true" />
            </Link>
          )}
          <p className="halo-portal-note">{company ? "You set the direction. Your agents take it forward." : "Build what comes next."}</p>
        </div>
      </div>
    </Portal>
  );
}
