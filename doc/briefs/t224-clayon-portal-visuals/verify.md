> adopt the peer role: read and follow `~/usr/antl/com.agents/skills/moe-roles/references/peer.md` before anything below.

# t224 — clayon portal visual verification

- **Leader session:** antl-4d. **Thread:** `docs/superpowers/threads/t224-clayon-portal-visuals.md`. **Boss:** clayon-rename stream. Owning record: `com.clayon/doc/design/halo-portal/DECISIONS.md` (read it first).
- **Report back when done** via SendMessage to antl-4d: screenshot paths, observed defects with element/file references, what stayed unverified.
- **Raise concerns immediately** to antl-4d.

## Outcome

Visually verify the new portal first screen — `com.clayon/ui/src/components/portal`, `pages/Auth.tsx`, `pages/PortalHome.tsx` — with real screenshots at 390x844 (mobile) and 1280x800 (desktop), light and dark mode where the app has both. Gates and tests already pass; what is missing is visual proof.

## Method

1. Read `com.clayon/doc/DEVELOPING.md` and the halo-portal DECISIONS.md for how the ui dev server runs. Start it yourself if needed; keep logs under `/tmp/projects/antl/t224/`; close it when done.
2. Use `agent-browser` (the sanctioned browser tool; see `~/.claude/docs/claudemd/agent-browser.md` if present) to set each viewport, load the portal first screen, Auth and PortalHome, toggle theme if a toggle exists, and capture screenshots.
3. Judge each screenshot against the DECISIONS.md expectations and Gold's leaf-node design law (`~/usr/antl/docs/convention/design-system.md`): token-only colors, spacing scale, hairline bands.
4. Save screenshots under `/tmp/projects/antl/t224/` with named files (`auth-390-light.png` etc.).

## Fences (boss, binding)

- Read-only on all com.clayon source: no `ui/` edits, no edits at all — screenshots and findings only.
- Never touch com.clayon git state or the Dokploy stack.

## Constraints

- No commits. No SendMessage to the boss; defects go to antl-4d, who relays.

## Completion check

Every listed screen × viewport × theme combination either has a screenshot on disk or a named reason it cannot be captured, and every observed defect is written with its file/element anchor.
