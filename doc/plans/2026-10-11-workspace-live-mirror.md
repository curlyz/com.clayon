# Workspace live mirror

Date: 2026-10-11

Status: proposed spec. No code exists. Operator picks (2026-10-11): VPS is
the source of truth, laptop is a live mirror, read-only first, no live `.git`,
one mirror folder per project workspace.

## Outcome

Agents run on the VPS and edit workspace files. Within about a second, the
same files appear in a folder on the operator's laptop, so local agents read
them. Phase 1 is one-way (VPS to laptop). Phase 2 adds checked write-back.

## Why not Mutagen or Syncthing

- Mutagen reaches remote files only over SSH or a local `docker://` endpoint.
  The VPS is Dokploy-only, so SSH is not allowed.
- Syncthing needs an extra exposed port and device pairing, and Clayon
  would not own conflict behavior, auth, or per-company scoping.
- With one authoritative side, the hard part of two-way sync (merging
  concurrent edits) disappears. A thin hub is smaller than an adapter layer.

Mutagen's model is reused: remember the last agreed state, compare each side
to it, transfer only the delta, apply atomically.

## Fit with the existing code (verified 2026-10-11)

| existing | file | use |
| :-- | :-- | :-- |
| WebSocket upgrade with board/agent auth, company-scoped | `server/src/realtime/live-events-ws.ts` | copy its `noServer` upgrade and auth pattern for a `/sync` socket |
| Finalization advisory lock, key company + run | `server/src/services/native-runtime/native-workspace-finalization-ownership.ts` | journal pauses while a run holds it (copyback) |
| Directory snapshots, manifests, exclusions | `packages/adapter-utils/src/workspace-manifest.ts`, `workspace-restore-merge` | reuse exclusion rules; do not add a second definition |
| Batch stage-in and copyback | `server/src/services/native-runtime/native-workspace-sync.ts` | unchanged; live mirror is additive |
| CLI commands | `cli/src/commands/` | new `sync.ts` |
| Workspace identity | `execution_workspaces`, `project_workspaces` tables | mirror is keyed by workspace id |

Not yet verified: the on-disk path of a VPS workspace root, and whether the
exclusion list is exported as a reusable function. Settle both before coding.

## Design

```
VPS: watcher -> journal (seq) -> /sync WebSocket  -> laptop client
                              -> GET /blobs/:hash <- laptop client
laptop: temp file + rename into mirror folder
```

### Journal

Per workspace, in Postgres (metadata only; file bytes stay on disk).

| column | meaning |
| :-- | :-- |
| `company_id`, `workspace_id` | scope; every query is company-scoped |
| `seq` | bigint, monotonic per workspace |
| `op` | `put`, `delete`, `rename` |
| `path` | workspace-relative, normalized, no `..`, no symlink escape |
| `sha256`, `size`, `mode` | content identity for `put` |
| `origin` | `vps` or a client id, for echo suppression |
| `created_at` | for trimming |

Retention: keep the last 10,000 entries or 24 h per workspace, whichever is
smaller. A client older than the oldest entry does a manifest resync.

### Watcher (VPS)

- `@parcel/watcher` on the workspace root, used as documented.
- Debounce 100 ms per path, coalesce repeated puts, hash after the file is
  stable (size and mtime unchanged for one debounce).
- Skip paths matched by the existing workspace exclusions, and always skip
  `.git/`, `node_modules/`, and anything above the size cap.
- A change to a path whose case-folded name collides with another path is
  reported as a `collision` event and not mirrored.

### Protocol

WebSocket `GET /api/companies/:companyId/workspaces/:workspaceId/sync`
(path-based on the brand domain, per the API standard). JSON messages:

| direction | message | fields |
| :-- | :-- | :-- |
| client to server | `hello` | `sinceSeq`, `clientId`, `protocol: 1` |
| server to client | `snapshot_required` | sent when `sinceSeq` is older than the journal |
| server to client | `events` | batch of journal entries, ascending `seq` |
| server to client | `paused` / `resumed` | finalization lock fence, with `reason` |
| client to server | `ack` | `seq` applied |
| server to client | `collision` | path, reason |

Blobs: `GET /api/companies/:companyId/workspaces/:workspaceId/blobs/:sha256`
returns the file, `zstd` if accepted, HTTP range supported. The server
verifies the hash belongs to a live journal entry of that workspace.

Manifest resync: `GET .../manifest?prefix=` returns a per-directory hash
tree; the client walks only differing directories.

### Laptop client

New `clayon sync <workspace> --dir <path>` in `cli/src/commands/sync.ts`.

- Applies each event atomically: write temp file in the same directory,
  `fsync`, rename. Delete removes the file and prunes empty directories.
- Stores `lastSeq` in `<dir>/.clayon-sync.json` (excluded from sync).
- Reconnects with backoff 1 s to 30 s and resumes from `lastSeq`.
- Read-only in phase 1: if a local file differs from the last mirrored hash,
  the client moves it to `<dir>/.clayon-conflicts/<timestamp>/` and writes
  the VPS version. Local edits are never silently lost.

### Finalization fence

While `withNativeWorkspaceFinalizationOwnership` is held for a run on the
workspace, the hub sends `paused`, queues events without applying them to
clients, and sends `resumed` after the lock is released. The mirror therefore
never shows a half-finished copyback. The hub only reads the lock state; it
never takes the lock.

### Auth

- Board user with workspace read access, or an agent key scoped to the
  company. Reuse the actor resolution in `live-events-ws.ts`.
- One socket per client id; a second connection with the same id closes the
  first.

## Phase 2: checked write-back

- Client sends `put` with `baseSha256` (the hash it last mirrored).
- Server applies only if the current file hash equals `baseSha256`;
  otherwise replies `rejected` with the current hash, and the client keeps
  its version in `.clayon-conflicts/`.
- Writes carry `origin = clientId`; the origin is skipped on fan-out to that
  client but delivered to others.
- Needs a per-workspace opt-in, off by default.

## Phase 3: large files

Chunk-level deltas (content-defined chunking) and a status panel in the UI.
Out of scope until phase 1 and 2 are measured.

## Caps and cost (proposed; confirm before build)

| limit | value | reason |
| :-- | :-- | :-- |
| file size | 25 MB | above this, skip and report |
| files per workspace | 50,000 | watcher and manifest bound |
| event rate | 200 events/s per workspace, then batch | burst from build tools |
| concurrent sockets | 5 per workspace | bound fan-out |
| blob egress | 2 GB/day per company, then pause with a visible reason | no hard provider cap exists on the VPS, so this is the cap |

Cost: the hub runs inside the existing server on the VPS. It adds journal
rows, file reads, and egress. It adds no Cloudflare Workers, Durable Objects,
cron, or paid provider calls. Verify egress and database growth after the
first day of use.

## Failure modes

| case | behavior |
| :-- | :-- |
| laptop offline | resumes from `lastSeq`, or manifest resync |
| journal trimmed | `snapshot_required`, then manifest resync |
| file changes while being read | blob hash mismatch, client refetches |
| VPS restart | watcher rescans, emits a diff against the last journal state |
| path escape or symlink out of root | event dropped, `collision` style report |
| `.git` | never mirrored; Git state moves by push and pull |

## Proof plan

1. VPS edit appears in the laptop folder in under 1 s (measure p50 and p95).
2. Kill and restart the client mid-burst; mirror converges, no partial files.
3. Trigger a copyback; clients receive `paused`, then `resumed`, and never
   see intermediate state.
4. Edit a mirrored file locally in phase 1; it lands in `.clayon-conflicts/`.
5. A client of another company cannot read the socket or blobs.

## Open decisions

| # | decide | my pick |
| :-- | :-- | :-- |
| 1 | Mirror root on the laptop | `~/clayon-mirror/<company>/<project>` |
| 2 | Caps above | as proposed, review after one week |
| 3 | Exclusions | reuse existing workspace exclusions; add none |
