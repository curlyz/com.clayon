# Clayon MCP Server

Model Context Protocol server for Clayon.

This package is a thin MCP wrapper over the existing Clayon REST API. It does
not talk to the database directly and it does not reimplement business logic.

## Authentication

The server reads its configuration from environment variables:

- `CLAYON_API_URL` - Clayon base URL, for example `http://localhost:3100`
- `CLAYON_API_KEY` - bearer token used for `/api` requests
- `CLAYON_COMPANY_ID` - optional default company for company-scoped tools
- `CLAYON_AGENT_ID` - optional default agent for checkout helpers
- `CLAYON_RUN_ID` - optional run id forwarded on mutating requests

Inside an active heartbeat, Clayon also injects `CLAYON_RUNTIME_TOOLS_*` variables. They enable the run-scoped `connections_search` and `connection_request` tools and expire with the run.

## Usage

```sh
npx -y @clayon/mcp-server
```

Or locally in this repo:

```sh
bun run --filter @clayon/mcp-server build
node packages/mcp-server/dist/stdio.js
```

## Tool Surface

Run-scoped connection tools:

- `connections_search`
- `connection_request`

Read tools:

- `clayonMe`
- `clayonInboxLite`
- `clayonListAgents`
- `clayonGetAgent`
- `clayonListIssues`
- `clayonGetIssue`
- `clayonGetHeartbeatContext`
- `clayonListComments`
- `clayonGetComment`
- `clayonListIssueApprovals`
- `clayonListDocuments`
- `clayonGetDocument`
- `clayonListDocumentRevisions`
- `clayonListProjects`
- `clayonGetProject`
- `clayonGetIssueWorkspaceRuntime`
- `clayonWaitForIssueWorkspaceService`
- `clayonListGoals`
- `clayonGetGoal`
- `clayonListApprovals`
- `clayonGetApproval`
- `clayonGetApprovalIssues`
- `clayonListApprovalComments`

Write tools:

- `clayonCreateIssue`
- `clayonUpdateIssue`
- `clayonCheckoutIssue`
- `clayonReleaseIssue`
- `clayonAddComment`
- `clayonSuggestTasks`
- `clayonAskUserQuestions`
- `clayonRequestConfirmation`
- `clayonUpsertIssueDocument`
- `clayonRestoreIssueDocumentRevision`
- `clayonControlIssueWorkspaceServices`
- `clayonCreateApproval`
- `clayonLinkIssueApproval`
- `clayonUnlinkIssueApproval`
- `clayonApprovalDecision`
- `clayonAddApprovalComment`

Escape hatch:

- `clayonApiRequest`

`clayonApiRequest` is limited to paths under `/api` and JSON bodies. It is
meant for endpoints that do not yet have a dedicated MCP tool.
