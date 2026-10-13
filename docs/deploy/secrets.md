---
id: antl:clayon/docs/deploy/secrets
title: Secrets Management
summary: Master key, encryption, and strict mode
---

Clayon encrypts secrets at rest with a local master key. Sensitive agent environment variables (API keys, tokens) are stored as encrypted secret references.

## Custody Boundaries

Clayon protects secret values up to the moment they reach an agent
or workload:

- Storage: values are encrypted at rest by the active provider. The local
  provider keeps them encrypted with a key that never leaves the host.
- Transport: values are decrypted server-side and injected into the agent
  process environment, SSH command env, sandbox driver, or HTTP request
  immediately before the call. Clayon does not return decrypted values to
  the board UI.
- Audit: each resolution records a non-sensitive event (secret id, version,
  provider id, consumer, outcome) without the value or provider credentials.

Once a value reaches the consuming process, Clayon can no longer guarantee
secrecy. The agent (or sandbox, or remote host) can read it, write it to
its own logs or transcript, or pass it downstream. Treat any secret bound to an
agent as exposed to that agent. Limit blast radius: bind only what each agent
needs, prefer short-lived provider credentials where supported, and rotate when
an agent transcript or downstream system might have captured a value.

## Using Secrets In Runs

Creating a company secret does not automatically create an environment variable.
Use a secret by binding it into an agent, project, environment, or plugin
configuration field that supports secret references.

For agent and project environment variables:

1. Create or link the secret in `Company Settings > Secrets`.
2. Open the agent's `Environment variables` field, or the project's `Env`
   field.
3. Add the environment variable key the process expects, such as `GH_TOKEN` or
   `OPENAI_API_KEY`.
4. Set the row source to `Secret`, select the stored secret, and choose either
   `latest` or a pinned version.

At runtime, Clayon resolves the selected secret server-side and injects the
value under the binding row's env key. The stored secret name can be
human-readable; the binding key is what the agent process receives.

Project env applies to every issue run in that project. When a project env key
matches an agent env key, the project value wins before Clayon injects its
own `CLAYON_*` runtime variables.

Separately from env bindings, the **server itself** consumes a company secret
named `GITHUB_TOKEN`, `GH_TOKEN`, or `CLAYON_GITHUB_TOKEN` (by name, no
binding needed) to authenticate server-side git operations — cloning private
GitHub repos for repo-only project workspaces and refreshing worktree base
refs. See
Execution workspaces `antl:clayon/docs/guides/board-operator/execution-workspaces-and-runtime-services#private-repositories-and-repo-only-project-workspaces`.

## User-Specific Secrets

User-specific secrets let a shared agent or project declare a slot such as
`github_api_token`, then resolve the value owned by the run's responsible user
at dispatch time. The environment binding stores only the definition key:

```json
{
  "env": {
    "GITHUB_TOKEN": {
      "type": "user_secret_ref",
      "key": "github_api_token",
      "required": true,
      "allowMissingOverride": false
    }
  }
}
```

Clayon stores the feature as value-free metadata plus the user's own secret
value record:

- `user_secret_definitions`: company-level metadata for the reusable slot.
- `user_secret_declarations`: target/config-path declarations for
  `user_secret_ref` bindings, including required/optional policy.
- `company_secrets` rows with `scope = "user"`, `owner_user_id`, and
  `user_secret_definition_id`: the current user's actual value record.
- `company_secret_versions`: encrypted or provider-backed version metadata for
  the value record.

Board/admin operators manage definitions and coverage. Individual users manage
their own values. Board/admin coverage views must stay metadata-only: they can
show missing, configured, inactive, provider, and vault status, but not
plaintext values, raw external refs, provider credentials, or provider error
payloads.

Required user-secret refs fail closed when the responsible user is missing,
the definition is missing, or the responsible user has no active value.
Optional refs may omit the env var. They must not inject blank credentials or
fall back to another user's value.

### Vault Placement

User-scoped values can use the same provider families as company secrets:

- `local_encrypted`: default local path. Fits local trusted installs and small
  self-hosted deployments. The same master key protects company and
  user-scoped values.
- `aws_secrets_manager`: hosted/provider-vault path. Use when the deployment
  already relies on AWS Secrets Manager, KMS, CloudTrail, and infrastructure
  IAM for custody.
- Dedicated provider vaults: optional. Use one only when you need a separate
  AWS account, Region, KMS key, prefix, retention posture, or import boundary
  for user-owned values. Never one vault per user by default; prefer one vault
  per environment or compliance boundary.

A user-secret definition can carry provider and vault defaults. A user's value
may also carry provider/vault metadata where the implementation path supports
overrides. In both cases, provider vault config holds non-secret routing
metadata only. Provider credentials still come from deployment infrastructure
identity, not from Clayon secrets.

### External Reference Naming

External vault references are secret-adjacent metadata. Treat paths, ARNs,
versions, aliases, and tags as operationally sensitive even though they are not
plaintext secret values.

Recommended external ref shape for operator-owned AWS paths:

```text
clayon-ext/{environment}/{company-id}/user-secrets/{definition-key}/{opaque-owner-id}
```

Guidance:

- Use the user-secret definition key for the credential type, such as
  `github_api_token`.
- Use an opaque stable user id or one-way mapped subject id for the owner
  segment. Avoid emails, personal names, customer names, OAuth scopes, or
  ticket identifiers in provider paths.
- Keep provider metadata value-free. Safe metadata: provider id, vault id,
  Region, KMS key id or alias, tag counts, fingerprint hashes. Never store raw
  AWS descriptions, full tag maps, token scopes, provider error bodies, or
  anything copied from the secret value.
- Keep Clayon-managed AWS values under the Clayon managed namespace. External
  refs there are blocked by guardrails; use the Clayon-managed flow when
  Clayon should create and rotate the value.

### IAM Caveats

Clayon enforces company scoping, responsible-user derivation, declaration
policy, current-user value APIs, redaction, and access-event metadata. It does
not replace an external vault's IAM policy.

For AWS Secrets Manager, the Clayon runtime role needs `GetSecretValue` and
any required KMS decrypt permission for every user-scoped value it may resolve.
Linking user-specific external refs outside the Clayon managed prefix: scope
those permissions to the approved external prefixes and KMS keys. AWS
tag/name filters help operators search but are not a reliable permission
boundary for resolution.

For stronger provider-side isolation, split user-secret workloads by provider
vault, AWS account, Region, prefix, or runtime role before linking the refs.
Clayon can prevent an agent from choosing another credential owner, but a
runtime role with broad external vault read permissions still reads whatever
IAM allows if another code path appears outside Clayon.

## Default Provider: `local_encrypted`

Secrets are encrypted with a local master key stored at:

```
~/.clayon/instances/default/secrets/master.key
```

This key is auto-created during onboarding. It never leaves your machine.
Clayon best-effort enforces `0600` permissions when creating or loading the
key file. `clayon doctor` and the provider health API warn when the file is
readable by group or other users.

Back up the key file with the database backups. A database backup without the
key cannot decrypt local secrets; a key backup without database metadata is
not enough to restore named secret versions.

## Configuration

### CLI Setup

Onboarding writes default secrets config:

```sh
pnpm clayon onboard
```

Update secrets settings:

```sh
pnpm clayon configure --section secrets
```

Validate secrets config:

```sh
pnpm clayon doctor
npx clayon secrets doctor --company-id <company-id>
```

### Environment Overrides

- **`CLAYON_SECRETS_MASTER_KEY`** — 32-byte key as base64, hex, or raw string
- **`CLAYON_SECRETS_MASTER_KEY_FILE`** — Custom key file path
- **`CLAYON_SECRETS_STRICT_MODE`** — Set to `true` to enforce secret refs

## Strict Mode

When strict mode is enabled, sensitive env keys (matching `*_API_KEY`, `*_TOKEN`, `*_SECRET`) must use secret references instead of inline plain values.

```sh
CLAYON_SECRETS_STRICT_MODE=true
```

Recommended for any deployment beyond local trusted.

Authenticated deployments default strict mode on unless explicitly overridden by
configuration or `CLAYON_SECRETS_STRICT_MODE=false`.

## External References

Provider-owned secrets can be linked without copying values into Clayon via
`managedMode: "external_reference"` plus a provider `externalRef`.
Clayon stores metadata and a non-sensitive fingerprint, never the value.
Runtime resolution remains server-side and binding-enforced.

The built-in AWS, GCP, and Vault provider IDs currently accept external
reference metadata, but runtime resolution requires provider configuration in
the deployment. Their provider health check reports a warning until configured.

For hosted Clayon Cloud on AWS, see the AWS Secrets Manager operational
contract — required env vars, IAM/KMS scoping, naming and tag conventions, and
backup/rotation/incident runbooks — in `doc/SECRETS-AWS-PROVIDER.md`.

## Provider Vaults

A *provider vault* is a named, company-scoped configuration pointing secret
material at one supported provider backend. Each company can configure multiple
vaults, including more than one per provider family, and pick a default vault
per family for new secret operations. Secrets created before any vault was
configured keep resolving through the deployment-level default provider — no
migration required.

### Where to configure

Open `Organization Settings → Secrets` in the board UI, switch to the
`Provider vaults` tab. From there:

- Create a vault for any supported provider family.
- Edit the non-secret config of an existing vault.
- Set one ready vault per provider family as the company default.
- Disable a vault (a soft delete that keeps audit history).
- Run a health check against a vault and read the latest result inline.

The same operations are exposed under
`/api/companies/{companyId}/secret-provider-configs` for automation. See the
secrets API reference `antl:clayon/docs/api/secrets#provider-vaults` for the full route table.

### Custody Of Provider Credentials

Provider vaults intentionally store only **non-sensitive** configuration:
region, project id, namespace, prefix, KMS key id, mount path, address, and
similar routing metadata. The API, UI, and activity log never accept, return,
or display provider credential values. Submitting fields with names like
`accessKeyId`, `secretAccessKey`, `token`, `password`, `serviceAccountJson`,
`privateKey`, `keyFile`, `unsealKey`, or any common credential alias is rejected
at validation time.

That keeps the AWS bootstrap rule applicable to every provider family:
**provider credentials live in deployment infrastructure identity, not in
Clayon company secrets**. Allowed credential sources: workload identity
attached to the Clayon server (instance profile, IRSA, ECS task role),
`AWS_PROFILE` / SSO / shared config for local runs, an orchestrator secret
store that boots the server, or short-lived shell credentials for local
development. Never paste long-lived API keys into vault config.

### Vault Status

Each vault carries a status that drives what the runtime can do with it:

- **`ready`** — Selectable for create/rotate/resolve. Eligible to be the default.
- **`warning`** — Saved config exists but health needs attention (for example missing AWS env). Still selectable.
- **`coming_soon`** — Visible and editable as draft metadata, but locked out of all runtime operations.
- **`disabled`** — Soft-deleted. Hidden from the secret create/rotate flow.

`gcp_secret_manager` and `vault` stay pinned to `coming_soon` until their
runtime modules ship. The settings UI lets you save draft configuration for
those providers (and surfaces them on the vault list), but secret create,
rotate, and resolve calls targeting a coming-soon vault fail with a clear
runtime-locked error.

### Default Vault Behavior

A company can mark **one** ready (or warning) vault per provider family as the
default. The create and rotate dialogs preselect it for the chosen provider.
Coming-soon and disabled vaults cannot be marked default; attempting it
returns a validation error. A new default automatically clears the previous
default for that provider.

A secret created without `providerConfigId` (no vaults yet, or the operator
cleared the selector) resolves at runtime through the deployment-level provider
configuration — the path existing installs use. Secrets created before any
vault keep working without migration. Picking a default in the UI is an
explicit selection, not a runtime fallback: the create call still sends an
explicit `providerConfigId`.

### Multiple Vaults Per Provider

Multiple vaults from the same provider family are first-class. Common patterns:

- Two AWS vaults at different regions or KMS keys for environment separation.
- A staging Vault address alongside a production address.
- A dedicated GCP project for one product line while the rest of the company
  uses another.

Each vault has its own display name, status, default flag, and health record.
Operators choose the vault explicitly when creating or rotating; the default
is preselected to avoid accidental routing to the wrong account.

### Per-Vault Health Checks

`POST /api/secret-provider-configs/{id}/health` runs a provider-specific probe
and stores the result on the vault row. The settings UI exposes the same action
and renders the result inline. Health responses include a status,
operator-facing message, and structured guidance (missing env var names,
expected credential sources, backup reminders). They never include provider
credentials or secret values. Coming-soon vaults always return a
`runtime_locked` health code and never call provider modules.

### Provider-Specific Notes

**Local encrypted vaults** wrap the existing `local_encrypted` provider. The
master key path and rotation guidance above still applies. A local vault config
is mostly bookkeeping plus an explicit acknowledgement that the key file is
backed up alongside the database.

**AWS Secrets Manager vaults** read the per-vault `region`, `namespace`,
`secretNamePrefix`, `kmsKeyId`, `ownerTag`, and `environmentTag` to route
managed writes and external-reference reads. The vault config supplements (and
can override) the deployment-level `CLAYON_SECRETS_AWS_*` env. Bootstrap
credentials still come from the AWS SDK default credential chain — see
`doc/SECRETS-AWS-PROVIDER.md` for the full IAM and KMS contract.

**GCP Secret Manager** and **HashiCorp Vault** vaults are coming soon. Save
draft `projectId`, `location`, `namespace`, `address`, and `mountPath`
metadata so the company is ready when the provider modules ship. Vault
`address` values must be origin-only `http(s)://host[:port]` URLs; addresses
with embedded credentials, paths, query strings, or fragments are rejected.

### Remote Import From AWS Vaults

AWS provider vaults can import existing AWS Secrets Manager entries as Clayon
`external_reference` secrets. Metadata-only link: Clayon stores the AWS
ARN/path, a fingerprint/version reference, and binding metadata. It never
reads, copies, stores, logs, or displays the remote plaintext secret value
during preview or import.

Operator flow in the board UI:

1. Open `Company Settings -> Secrets`.
2. Confirm at least one AWS provider vault is `ready` or `warning`.
3. In the `Secrets` tab, choose `Import from vault`.
4. Select an AWS vault, search the remote inventory, and load more pages as
   needed.
5. Check the rows to import, review/edit the Clayon name and key, then
   submit.
6. Review the result summary for created, skipped, and failed rows.

The preview list is intentionally paged and search-first. AWS accounts can have
large per-Region inventories, and `ListSecrets` returns opaque `NextToken`
cursors. Clayon never crawls a whole account in the background; load pages
deliberately and retry throttled requests with backoff.

Remote import exposes AWS secret metadata visible to the Clayon runtime role,
including names/ARNs and safe derived fields such as dates, whether a
description or KMS key exists, and tag count. Treat names, ARNs, tags, and
search text as operational metadata that may be sensitive. The API and activity
log must not store raw descriptions, tags, plaintext values, provider
credentials, or raw AWS error blobs.

Required AWS posture:

- Preview needs optional `secretsmanager:ListSecrets` permission on
  `Resource: "*"`. AWS does not support constraining `ListSecrets` to
  individual secret ARNs or tags as an IAM boundary.
- Preview/import must not call `secretsmanager:GetSecretValue`,
  `secretsmanager:BatchGetSecretValue`, or KMS decrypt.
- Runtime resolution of an imported reference still needs
  `secretsmanager:GetSecretValue` on the selected external ARN/path and KMS
  decrypt when that secret uses a customer-managed key.
- Keep managed create/rotate/delete permissions scoped to the Clayon
  deployment prefix. Never broaden managed write/delete permissions just
  because import inventory is enabled.

Safe scoping comes from deployment posture, not AWS list filtering: dedicated
Clayon runtime roles per environment/account, AWS vaults pointed at the
intended account and Region, import-enabled roles only where inventory
exposure is acceptable, board-only access to the import routes. Tags and name
filters are search aids, not a permission model.

If import preview fails:

- `AccessDenied` or `not authorized`: the runtime role is missing
  `secretsmanager:ListSecrets`; add the optional inventory statement only if
  remote import should be enabled for that vault.
- Throttling: retry after a short delay; narrow the search before loading
  more pages.
- Invalid cursor: refresh the preview; AWS `NextToken` values are opaque and
  can expire or become stale.
- Runtime resolution failure after import: verify `GetSecretValue` and KMS
  decrypt scope for the selected external secret. Inventory visibility is
  not proof the runtime role can read the value.

### Backup And Restore

Each provider family has a different backup story:

- `local_encrypted`: back up the local master key file and the Clayon
  database together. Either alone is not enough to restore encrypted values;
  the vault row records only the path and acknowledgement, not key bytes.
  User-scoped values included: the database holds
  `user_secret_definitions`, `user_secret_declarations`,
  `company_secrets.scope = "user"` rows, version metadata, and owner ids; the
  key file is required to decrypt their local material.
- `aws_secrets_manager`: back up Clayon's database for vault metadata
  (vault id, region, prefix, KMS key id, default flag, bindings, version
  pointers, user-secret definitions/declarations, owner ids, access-event
  metadata). Secret values live in AWS Secrets Manager under the configured
  prefix or operator-owned external refs; restore by pointing the same Clayon
  company at the same AWS namespace and confirming the runtime role still has
  `GetSecretValue` plus KMS decrypt for both managed and linked user-scoped
  values. Full restore checklist: `doc/SECRETS-AWS-PROVIDER.md`.
- `gcp_secret_manager` and `vault`: coming soon — only the draft vault config
  exists in Clayon. Database backups capture it. Nothing to restore on the
  provider side until runtime support lands.

### AWS Provider Bootstrap Boundary

The AWS Secrets Manager provider cannot bootstrap itself from Clayon
`company_secrets`. Initial AWS access must exist before the server can create
or resolve AWS-backed company secrets, deployment-level default or per-company
vault alike.

For Clayon Cloud: provision the server runtime IAM role/workload identity,
KMS key, deployment prefix, and non-secret `CLAYON_SECRETS_AWS_*` environment
configuration before enabling AWS-backed secrets in the board UI. For
self-hosted and local runs: AWS SDK default credential chain — instance
profile, ECS task role, EKS IRSA/OIDC web identity, AWS SSO/shared config via
`AWS_PROFILE`, or short-lived shell credentials for local development.

Never store AWS root credentials or long-lived IAM user access keys in Clayon
secrets. Bootstrap material belongs in infrastructure IAM/workload identity,
the process environment, an AWS profile, or the orchestrator secret store.

## Migrating Inline Secrets

Existing agents with inline API keys in config: migrate them to encrypted secret refs:

```sh
npx clayon secrets migrate-inline-env --company-id <company-id>
npx clayon secrets migrate-inline-env --company-id <company-id> --apply

# low-level script for direct database maintenance
pnpm secrets:migrate-inline-env         # dry run
pnpm secrets:migrate-inline-env --apply # apply migration
```

Use the CLI command for normal operations: it goes through the Clayon API,
creates or rotates secret records, and updates agent env bindings with audit
logging.

## Portable Declarations

Company exports include only environment declarations — not secret IDs,
provider references, encrypted material, or plaintext values.

```sh
npx clayon secrets declarations --company-id <company-id> --kind secret
```

Before importing a package into another instance, use those declarations to
create local values or link hosted provider references in the target
deployment. For hosted providers such as AWS Secrets Manager, the hosted
provider remains the value custodian; Clayon stores metadata and provider
version references, never provider credentials or plaintext secret values.

## Secret References in Agent Config

Agent environment variables use secret references:

```json
{
  "env": {
    "ANTHROPIC_API_KEY": {
      "type": "secret_ref",
      "secretId": "8f884973-c29b-44e4-8ea3-6413437f8081",
      "version": "latest"
    }
  }
}
```

The server resolves and decrypts these at runtime, injecting the real value into the agent process environment.
