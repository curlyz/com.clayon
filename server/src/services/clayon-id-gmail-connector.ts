/**
 * @deprecated Clayon ID is identity-only. Import the Clayon Cloud
 * connector names from `clayon-cloud-connector.ts` for new code.
 *
 * These aliases keep source compatibility while deployments and persisted app
 * definitions move from the former Clayon ID broker prototype.
 */
export {
  GMAIL_CONNECTOR_SCOPES,
  GMAIL_MCP_URL,
  GOOGLE_WORKSPACE_CONNECTOR_PROFILES,
  ClayonCloudConnectorError as ClayonIdConnectorError,
  createClayonCloudConnector as createClayonIdGmailConnector,
  clayonCloudConnectorCapabilitiesFromEnv as clayonIdGoogleConnectorCapabilitiesFromEnv,
  clayonCloudConnectorConfigFromEnv as clayonIdGmailConnectorConfigFromEnv,
} from "./clayon-cloud-connector.js";

export type {
  ClayonCloudConnector as ClayonIdGmailConnector,
  ClayonCloudConnector as ClayonIdGoogleWorkspaceConnector,
  ClayonCloudConnectorConfig as ClayonIdGmailConnectorConfig,
  ClayonCloudConnectorEnvironment as ClayonIdConnectorEnvironment,
  ClayonCloudConnectorOperation as ClayonIdConnectorOperation,
  SealedGmailCredentials,
  SealedGoogleWorkspaceCredentials,
} from "./clayon-cloud-connector.js";
