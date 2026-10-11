import {
  clayonCloudConnectorEnrollmentStatus,
  type ClayonCloudConnectorEnrollmentStatus,
} from "./clayon-cloud-connector-enrollment.js";
import {
  createClayonCloudConnector,
  clayonCloudConnectorConfigFromEnv,
} from "./clayon-cloud-connector.js";

export async function reconcileClayonCloudConnectorEnrollmentStatus(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<ClayonCloudConnectorEnrollmentStatus> {
  const local = clayonCloudConnectorEnrollmentStatus(env);
  if (!local.configured) return local;
  const config = clayonCloudConnectorConfigFromEnv(env);
  if (!config) return { ...local, configured: false, status: "not_configured" };
  try {
    const status = await createClayonCloudConnector({ config, request }).getInstanceStatus();
    if (status === "active") return { ...local, configured: true, status: "active" };
    if (status === "suspended") return { ...local, configured: false, status: "suspended" };
    return { ...local, configured: false, status: "not_configured" };
  } catch {
    return { ...local, configured: false, status: "unverified" };
  }
}
