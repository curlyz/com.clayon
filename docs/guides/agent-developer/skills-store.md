---
id: antl:clayon/docs/guides/agent-developer/skills-store
title: The Skills Store
summary: Browse, install, import, fork, and share the reusable skills your agents use
---

The **Skills Store** is Clayon's library of reusable skills. A skill is a markdown
playbook teaching an agent one kind of work — triage an issue,
write a wireframe, run QA acceptance, draft a release announcement. The Store is where
people (and agents) discover skills, install them into a company, and manage them
over time.

To *author* a skill, read Writing a Skill `antl:clayon/docs/guides/agent-developer/writing-a-skill`. This page is
the **store around** skills: where they come from, how they get into your company,
how you keep them current.

## Two layers: the catalog and your company library

Two distinct things get loosely called "the skills store":

| Layer | What it is | Lives in |
|---|---|---|
| **The catalog** | A curated, read-only set of skills that ships with Clayon | The `@clayon/skills-catalog` package |
| **Your company library** | The skills actually installed in *your* company, which agents can run | The `company_skills` database table |

The catalog is the shelf you browse. Your company library is the cart you checked
out. Installing a catalog skill copies it into your company library, where you edit,
version, fork, and share it independently of the original.

### The bundled catalog

The catalog builds from markdown under `packages/skills-catalog/catalog/`, compiled
into a manifest (`generated/catalog.json`) at build time. Each catalog skill is one
directory: a `SKILL.md` plus any supporting `references/`, `scripts/`, or
`assets/` files.

The catalog splits skills into two **kinds**:

- **`bundled`** — first-party Clayon skills (e.g. `issue-triage`, `task-planning`,
  `qa-acceptance`, `wireframe`, `github-pr-workflow`, `doc-maintenance`). These carry the
  reserved `clayon/clayon/...` key namespace.
- **`optional`** — additional curated skills you opt into (e.g. `agent-browser`,
  `design-critique`, `release-announcement`, `last30days`, `ramp`).

Every catalog skill carries metadata used for discovery and safety:

- **`category`** — grouping such as `software-development`, `quality`, `product`,
  `research`, `content`, `browser`, `clayon-operations`, `docs`.
- **`recommendedForRoles`** — agent roles the skill suits (`engineer`, `qa`, `designer`,
  `product`, `researcher`, …), used to suggest skills when staffing a company.
- **`trustLevel`** — see Trust levels `antl:clayon/docs/guides/agent-developer/skills-store#trust-levels-what-a-skill-is-allowed-to-carry`.
- **`compatibility`** — `compatible`, `unknown`, or `invalid`, derived during the build
  validation pass.
- **`contentHash`** — a hash of the skill's files, used later to detect updates and drift.

## Trust levels: what a skill is allowed to carry

A skill can bundle more than prose, so every skill is classified by how much trust
its contents require. The level is **derived from the files**, never self-declared:

| Trust level | Contains | Notes |
|---|---|---|
| `markdown_only` | Only `.md` files | Safest — pure instructions |
| `assets` | Markdown plus images/PDFs/other static files | No executable code |
| `scripts_executables` | Any script (`.sh`, `.js`, `.py`, `.ts`, …) | Highest scrutiny |

GitHub sources support scripts after the existing content audit passes. Importing
never executes scripts, hooks, dependency installers, or builds. Raw URL and
`skills.sh` imports keep their existing script restrictions. Unsafe content,
secrets, invalid paths, and oversized files stay rejected.

## Where skills come from (source types)

A skill in your company library records its origin. The Store shows it as a
**source badge**:

```text
[5]{Source type,Badge,Meaning}:
  `catalog`,Clayon / catalog,Installed from the bundled catalog
  `github`,GitHub,Imported from a GitHub repo (pinned to a commit)
  `skills_sh`,skills.sh,Imported via the [skills.sh](https://skills.sh) registry (resolves to GitHub)
  `url`,URL,Imported from a raw markdown URL
  `local_path`,Local,Created in-app or scanned from a project workspace on disk
```

Git-backed sources **must resolve to a pinned 40-character commit SHA** before
import. A moving branch cannot change what agents run until you refresh its source.
GitHub originals are read-only; **Make a copy** for an independent editable local skill.

### Thin wrappers for external live playbooks

Some optional catalog skills intentionally never vendor a third-party playbook. The
`ramp` skill is the model: Clayon ships the stable governance wrapper, source
allowlist, and approval gates, then tells the agent to fetch Ramp's current published
instructions from `agents.ramp.com` when the task starts.

Use this pattern only when the external provider's setup flow changes often enough
that a vendored snapshot would go stale, and Clayon can keep the safety boundary in
the wrapper. Financial, legal, or account-control domains: the wrapper must require
Clayon approvals before spend, incorporation, account authorization, card issuance,
data sharing, or other irreversible actions. Document the tradeoff in the
skill or PR so reviewers can weigh freshness against external-instruction risk. If
the provider mixes official and community playbooks on one host, the wrapper must
fail closed on unclear provenance and require separate approval before using any
third-party tool, connector, browser automation service, or credential flow
introduced by a fetched playbook.

## Getting skills into your company

Several paths, all landing a skill in your company library.

### Install from the catalog

Browse the catalog's discovery grid, pick a skill, install. Installing copies the
catalog skill's files into your company library and stamps provenance metadata (catalog
key, content hash, package version) so the Store can later tell you when the
upstream catalog skill changed.

- API: `POST /companies/:companyId/skills/install-catalog`
- Re-installing an installed catalog skill updates in place — never a duplicate.

### Sync skills from GitHub

Open **Skills → Sources → Import from GitHub** (also in the **New** menu), choose a connected repository or
click **… or add public repo by URL** to paste a GitHub.com repository URL, then choose **Find skills**. The searchable list
combines repositories from all GitHub connections you can access, duplicates
removed. Clayon automatically uses an authorized connection for the chosen
repository. Pasted URLs also use your authorized connections when available,
including public repositories outside the list. Public repositories can use
anonymous access when no connection succeeds; private repositories require access.

A repository URL uses the default branch. Paste a branch URL such as
`https://github.com/owner/repo/tree/feature/new-skills` to track another branch,
including branch names containing slashes. **Add repos**
opens the standard setup in Apps. Completing or cancelling setup returns you to
the importer with your draft retained; the repository list refreshes automatically.
Use the refresh button beside the repository count to reload accessible repositories.

The searchable tree starts with every discovered skill package checked, including
hidden and deeply nested directories. Each package shows name and file count;
expand to see its files. Folder checkboxes select descendant
packages. A package checkbox selects that whole directory, stopping at nested
`SKILL.md` boundaries; nested skills stay independently selectable. Supporting
files cannot be deselected individually.

The inspection button or clicking an included file opens a read-only preview.
The inspector shows repository path, scanned commit, byte sizes, executable
flags, and any author-declared `compatibility` requirements. Text previews
show up to 64 KiB; binary assets show metadata and a GitHub link for viewing or
download. Preview reads use the current caller's GitHub access and re-audit the
package at that exact commit. Preview failures never alter selection or installed
content. Existing sources gain inspection metadata on their next successful refresh.

**Check references** flags detectable Markdown links and inline-code relative
resource paths that are missing or outside the package, including files belonging to
nested skills. Best-effort check, never a complete dependency analysis;
references never cause external files to import automatically. Fix the source
or leave the package unchecked if it needs those files. Declared requirements
show separately from these warnings and from content-audit notices.

Validation errors appear beside affected skills; eligible selections import and
skipped skills are reported. These skills become available in the current company's
library and agent skill picker. Files limited to 1 MiB each, a scan to 100 MiB
of expanded skill content, counting repeated file copies. A scan supports up to
1,000 skill packages and 10,000 package files. The repository path index includes
directories: 100,000 paths max, 4,096 characters and 64 levels deep per path.
Discovery retains audited manifests, never every package's contents. Importing
never runs scripts, hooks, dependency installation, or builds.

Repeated scans resolve the branch's current commit and reuse the caller's cached
snapshot when unchanged. Each server process allows one active scan per
caller, two per company. Per minute: callers open 30 snapshots and download
6 repositories; companies open 60 snapshots and download 12 repositories.
Cached scans never consume the download quota. A limit returns a retry message;
installed skills stay available.

**Skills → Sources** shows repositories, installed skill links, and connection errors.
Click a repository title to open it on GitHub. Its three-dot menu: 
**Refresh**, **Select skills**, **Disconnect source**. **Refresh** applies valid
updates immediately. New skills wait for
**Select skills → Save selection** before import. Previously declined skills stay
unchecked, including additions beneath excluded folders.

Unchecking an installed skill stops future syncing and keeps its content and agent
assignments. **Disconnect source** does the same for the whole repository. Remove
an installed skill separately to drop it from the library. Upstream deletion
shows **Removed from source** and retains the installed version; a moved path is a
new skill, never an inferred rename.

Installed content is stored locally, so viewing, testing, and agent execution work
without GitHub access. Updates preserve skill identity, organization, assignments,
history. New versions appear only when package bytes or executable modes
change; active runs and pinned versions keep their existing content. Skill Studio
views and tests originals. **Make a copy** creates an independent editable skill.

Older imports with no saved tracking branch resolve the repository’s default branch
on their first successful refresh. If an explicit source already tracks that branch,
the adopted source keeps a **Default branch** alias so both sets of installed skill
identities and selections remain intact. Explicit branch and commit pins are preserved.

Recognizable older GitHub imports are adopted into Sources without refetching or
changing content; the first successful refresh completes their local snapshots.
Bundled/catalog, project/local, unsupported-host, and `skills.sh` imports keep their
existing behavior. Sync is manual and GitHub.com-only; upstream editing and pull
requests are not part of this milestone.

While finding skills, the dialog shows scan stages, the current file, and
recently checked skills as their local packages are validated. Large repositories show real
package and file counts; cancel and retry without importing partial
results. Selection opens only after the full scan completes. Importing shows
an animated saving state while complete local packages are prepared. Animations
respect reduced-motion preferences.

Clayon fetches one shallow Git snapshot, preserving committed bytes and executable
permissions without checking out or running repository code. Download progress shows
Git's measured receiving and preparing percentages before discovery begins. Git is
required on the server. Downloads limited to 128 MiB and three minutes; at most two
run concurrently. Up to four temporary snapshots (including active downloads) are kept
ten minutes, scoped to the company and caller's authorization. Preview and import
can reuse the exact scanned commit after rechecking access. Installed skills stay
local and independent of this temporary cache. GitHub's API still serves repository
identity and the connection picker, so metadata requests can still hit rate limits.

The discovery API keeps its normal JSON response. Clients requesting
`Accept: application/x-ndjson` receive `progress` and `candidate` events followed
by `complete` (containing the discovery response), or a terminal `error`. A stream
ending without `complete` failed; partial candidates are not importable.
Progress carries metadata only, never package file contents.

Source APIs live beneath `/api/companies/:companyId/skill-sources`:

```text
[8]{Method/path,Purpose}:
  `GET /` and `GET /:sourceId`,List sources and entries
  `GET /repositories`,Browse repositories through existing GitHub grants
  `POST /discover`,Discover and validate packages at one commit
  `POST /preview`,Preview an audited package file at an immutable commit using current caller access
  `POST /`,Import selected packages at the discovered commit
  `PATCH /:sourceId`,"Save selection/exclusions and optional connection, with revision check"
  `POST /:sourceId/refresh`,Refresh selected skills; discover new ones for review
  `DELETE /:sourceId`,Disconnect while retaining installed skills
```

### Import from an external source

Paste a source; Clayon fetches and imports it. Accepted forms:

- A GitHub repo or subfolder URL (`https://github.com/owner/repo/tree/<ref>/skills/foo`)
- A short `owner/repo` or `owner/repo/skill` reference
- A `skills.sh` URL or an `npx skills add …` command (both resolve to the GitHub source)
- A raw markdown URL pointing directly at a `SKILL.md`

A repo can hold many skills; the importer discovers every `SKILL.md` under the path
(optionally filtered to one `--skill` slug).

- API: `POST /companies/:companyId/skills/import`

### Create a local skill

Author directly in the company library, no external source. The
"new skill" path — you supply name, description, and markdown body; stored
as a `local_path` / managed-local skill.

- API: `POST /companies/:companyId/skills`

### Scan a project workspace

Agents and projects often keep skills on disk under conventional folders
(`skills/`, `.claude/skills/`, `.agents/skills/`, and many other tool-specific roots).
The project scan walks a workspace, finds those `SKILL.md` directories, and offers to
import them into the company library, reporting conflicts or skips.

- API: `POST /companies/:companyId/skills/scan-projects`

## Living with installed skills

Once a skill is in your library, the Store treats it like a small product with a
lifecycle.

### Versions

Each skill keeps a revision history. Saving a new version snapshots the full file
inventory (with content) and bumps the revision number — review history, roll back.

- List: `GET /companies/:companyId/skills/:skillId/versions`
- Create: `POST /companies/:companyId/skills/:skillId/versions`

### Updates, drift, and reset

Catalog- and external-source skills: the Store tracks the origin.
The **update status** endpoint compares your installed copy against the latest upstream
and reports update availability, local modification (*drift*), and any hold reason
blocking an automatic update.

- Check: `GET /companies/:companyId/skills/:skillId/update-status`
- Install the upstream update: `POST /companies/:companyId/skills/:skillId/install-update`
  (with `force` to override local drift)
- Discard local changes and return to the pristine origin:
  `POST /companies/:companyId/skills/:skillId/reset`

### Audit

Auditing compares the installed content hash against the recorded origin
hash, flagging tampering or unexpected drift. The audit returns a verdict plus
codes the Store surfaces as a health signal.

- API: `POST /companies/:companyId/skills/:skillId/audit`

### Fork

Forking copies an existing skill into a new, independent library entry (optionally
new name, slug, sharing scope). The fork records its source, and the
original's `forkCount` increments. Customize a catalog or community skill
without losing sight of the upstream.

- API: `POST /companies/:companyId/skills/:skillId/fork`

### Stars and comments

Skills are social objects inside the Store. Members **star** a skill (per-actor
toggle driving the `starCount`) and leave threaded **comments** for discussion and
review.

- Star / unstar: `POST` / `DELETE /companies/:companyId/skills/:skillId/star`
- Comments: `GET` / `POST /companies/:companyId/skills/:skillId/comments`,
  plus `PATCH` and `DELETE` for editing and removing.

## Sharing scope

Every company skill has a **sharing scope** that controls who can see it:

- **`private`** — Only the author/owner
- **`company`** — Everyone in the company
- **`public_link`** — Anyone with the generated public share token

Scope is set when creating, updating, or forking a skill, and the Store's discovery view
can filter by it.

## How agents actually use installed skills

Installing a skill is not running it. At runtime, a company's
installed skills are materialized into the agent's workspace as `SKILL.md` directories,
and the agent's harness loads each skill's **frontmatter `name` + `description`** as
routing logic. The agent reads those one-line descriptions to decide *whether* a skill is
relevant to the current task, and only then loads the full body. (This is why a skill's
`description` should read as "what this does and when to use it" — it is the index the
agent searches.)

Skill sync into agent workspaces follows a per-instance preference, so an operator
controls whether and how the company library reaches running agents.

## Reference: API surface

All endpoints are under the company-skills router.

**Catalog (read-only)**

- `GET /skills/catalog` — list the bundled catalog
- `GET /skills/catalog/:catalogId` — one catalog skill
- `GET /skills/catalog/:catalogId/files` — its file inventory + content

**Company library**

- `GET /companies/:companyId/skills` — list (supports `q`, `sort`, `categories`, `scope`)
- `GET /companies/:companyId/skills/categories` — category counts
- `GET /companies/:companyId/skills/:skillId` — detail
- `GET /companies/:companyId/skills/:skillId/files` — file inventory + content
- `POST /companies/:companyId/skills` — create a local skill
- `PATCH /companies/:companyId/skills/:skillId` — edit metadata / sharing scope
- `DELETE /companies/:companyId/skills/:skillId` — remove from the library
- `POST /companies/:companyId/skills/install-catalog` — install a catalog skill
- `POST /companies/:companyId/skills/import` — import from GitHub / skills.sh / URL
- `POST /companies/:companyId/skills/scan-projects` — scan workspaces for skills
- `POST /companies/:companyId/skills/:skillId/fork` — fork a skill
- `POST /companies/:companyId/skills/:skillId/versions` · `GET …/versions` · `GET …/versions/:versionId`
- `GET /companies/:companyId/skills/:skillId/update-status`
- `POST /companies/:companyId/skills/:skillId/install-update`
- `POST /companies/:companyId/skills/:skillId/reset`
- `POST /companies/:companyId/skills/:skillId/audit`
- `POST` / `DELETE /companies/:companyId/skills/:skillId/star`
- `GET` / `POST /companies/:companyId/skills/:skillId/comments` · `PATCH` / `DELETE …/comments/:commentId`

All mutating endpoints require permission to manage the company's skills and are recorded
in the company activity log.

## Reference: the catalog package

The catalog is its own publishable package, `@clayon/skills-catalog`:

- `catalog/bundled/**` and `catalog/optional/**` — the source skill directories
- `scripts/build-catalog-manifest.ts` — compiles the directories into `generated/catalog.json`
- `scripts/validate-catalog.ts` — validates frontmatter, keys, and trust classification
- `src/index.ts` — exports `catalogManifest`, `catalogSkills`, `getCatalogSkill(id)`, and
  `resolveCatalogSkillRef(ref)` for resolving a skill by id, key, or slug

To add a skill to the bundled catalog: create the directory with a `SKILL.md`, then run
the package's `build:manifest` (and `validate`) scripts to regenerate and check the
manifest.

## See also

- Writing a Skill `antl:clayon/docs/guides/agent-developer/writing-a-skill` — the `SKILL.md` format and authoring best practices
- How Agents Work `antl:clayon/docs/guides/agent-developer/how-agents-work` — how skills fit into a heartbeat

```
         (o)___(o)
        /         \
       |  o     o  |
       |     <     |
        \  \___/  /
         \_______/
        /         \
   ~~~ ribbit ~~~  skills! ~~~
```
