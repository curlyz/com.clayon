# t224 — clayon portal visual verification

Opened 2026-10-11 by leader antl-4d. Work order: clayon-rename stream (boss,
via moecli bridge message 7bffe8ee). Owning record:
`com.clayon/doc/design/halo-portal/DECISIONS.md`.

Task: visually verify the new portal first screen
(`ui/src/components/portal`, `pages/Auth.tsx`, `pages/PortalHome.tsx`) at
390x844 and 1280x800, light and dark where present. Typecheck/token
gates/tests already pass; no screenshots exist (Codex sandbox blocked
sockets).

Fences (boss): read-only on source; no `ui/` edits; no com.clayon git
state; no Dokploy stack.

Dispatch: 2026-10-11 antl-06 (g53f), brief
`docs/superpowers/briefs/t224-clayon-portal-visuals/verify.md`. Defects
return to the leader, relayed to the boss.
