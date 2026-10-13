---
id: antl:clayon/packages/clayon-runner/docs/adding-a-harness
---

# Adding a Harness

Every Runner harness must declare permission behavior in its provider contract. A driver is incomplete until its permission modes, max non-interactive default, durable request translation, recovery identity, isolation behavior, and conformance coverage are defined.

## Distribution

First-party harness glue belongs in the runner, not per-provider npm packages. Keep built-in launchers and metadata under `src/providers/<provider>/`; include them in the compiled runner and the public server's vendored runtime. Grok is the reference implementation. This keeps a public Clayon npm install self-contained as harnesses are added.

Native provider binaries stay execution-environment prerequisites. Provision them explicitly in sandbox images or on local execution hosts, independent of npm installation and the controller provider pack. Admission must verify the qualified version and executable checksum before credentials are delivered. Missing prerequisites produce an actionable error — never a silent download or unverified PATH fallback.

Use a distinct built-in launcher identity and native runtime identity in the qualified profile, recovery binding, provider-pack manifest, and eval config. Upstream npm-backed ACP bridges retain their package pins; no replacement or Clayon-name republishing required.

Verify public release tarballs in a clean consumer outside the checkout, npm lifecycle scripts enabled. Prove: launcher ships, npm does not install the native prerequisite, missing prerequisites fail closed, explicit provisioning permits verified execution. See `scripts/verify-grok-npm-install.mjs` at the repository root.

## Current permission catalog

| Provider | Agent configuration key | Supported values | Default |
|---|---|---|---|
| Codex | `codexPermissionMode` | `never`, `on-request`, `untrusted` | `never` |
| OpenCode | `opencodePermissionMode` | `allow`, `ask`, `deny` | `allow` |
| ACPX (Claude, Codex, Grok) | `acpxPermissionMode` | `approve-all`, `approve-clayon`, `approve-reads`, `deny-all` | `approve-all` |

Browser-safe source of truth for labels, defaults, and configuration validation: `CLAYON_RUNNER_PERMISSION_CAPABILITIES` in `@clayon/adapter-utils`. Native process boundaries re-validate the pinned provider value; never silently accept an unknown mode.

“Full auto” means no duplicate-approval pause inside the run's assigned environment. It grants no host-wide filesystem access, no unrestricted network access, no Clayon credentials, and no write access in read-only planning mode. Workspace containment, protected-path and symlink checks, network policy, credential bindings, and authenticated PRP authorization stay authoritative and run before any harness auto-approval.

## Driver requirements

When adding or upgrading a harness:

1. Declare the provider's exact native modes. Use its highest non-interactive mode as the default for fresh Runner executions.
2. Add its labels, configuration key, options, and default to the shared provider-discriminated capability catalog. The agent form shows only the selected provider's setting and retains stored choices across provider switches.
3. Pin the effective value in native execution input and provider recovery state. Include it in provider-session compatibility so a mode change replaces an incompatible warm session instead of mutating an active turn.
4. Translate every lower-mode prompt into the canonical runtime-request lifecycle: emit one durable request, recover it after reconnect, accept allow-once, allow-for-session, deny, and cancellation where supported, and send exactly one provider-native resolution.
5. Authorize Clayon semantic and question tools through authenticated PRP. These may bypass duplicate harness approval — never their control-plane authorization.
6. Emit provider and effective permission mode in session-start diagnostics, without credentials or unredacted provider input.
7. Keep standalone local adapters unchanged unless deliberately revised. Runner defaults apply only to `clayon_runner` executions.

## Compatibility rules

Native execution input v4 pins `approvalPolicy` for Codex and `permissionMode` for OpenCode and ACPX. Persisted v1-v3 executions stay replayable. Their missing Codex and OpenCode settings use the historical effective behavior; legacy ACPX `permissionPolicy: "interactive"` means the historical `approve-reads` behavior. Legacy fields are readable only; new agent configuration must not persist them.

Never rewrite an active execution on configuration change. A fresh execution carries the new policy and replaces an incompatible idle or checkpointed session through normal session-compatibility handling.

## Conformance checklist

A new driver must cover:

- agent create/edit defaults, selected-provider visibility, provider switching, invalid-value rejection, and no Runner sandbox-bypass control;
- native serialization, legacy replay, recovery identity, and replacement after a permission change;
- start and resume propagation for every supported mode;
- no runtime request in the maximum mode;
- once, session, and deny resolution in prompting modes, including every accepted provider event version;
- immediate rejection in deny mode;
- workspace and protected-path denial before auto-approval;
- authenticated semantic-tool behavior;
- an end-to-end default-mode write plus validation command completing without an Input needed permission card.

Run TypeScript, Rust, UI, protocol-generation, durable transport, and
documentation validation before declaring the harness qualified.
