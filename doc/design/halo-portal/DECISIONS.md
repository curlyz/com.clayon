# Clayon entry portal

Date: 2026-10-11. Outcome: a full-viewport threshold with depth, restrained motion, and one primary action.

## Brief 2: current authority and execution

Brief 2 supersedes the absent-reference gap and the first pass's warm square airlock.
Read-only references were restored at `/tmp/projects/antl/clayon/design-ref/doc/design/`.
The explicit scene brief overrides `DESIGN.md`'s earlier rejection of the Halo/space direction for this entry surface.
Square controls, token ownership, pixel rendering, interaction rules, and existing auth/access contracts remain authoritative.

Read order: `DESIGN.md`; Halo concept and art; pixel/space themes and art, lab/imhigh contrasts;
character bible and all eight turnaround sheets; app-experience; live Doc stage and interaction rules; previous portal sources.
The bible confirms that the generated Doc pilot drifts and Orb has no animation strip or Rive file.

| decision | picked | why |
| :-- | :-- | :-- |
| Composition | Full-screen ring sky, octagonal threshold, emblem, floor, entry object | Implements the supplied scene brief |
| Palette | Pixel violet, space black, amber action, mint focus | Uses restored pixel/space references; text stays readable |
| Crew art | Doc and Orb sampled from the supplied lab cast atlas | Small shared asset; recognizable silhouettes without drifting pilot frames |
| Sprite grid | Nearest-neighbor 64 × 64 canvas cells, 1× phone and 2× desktop | Whole-multiple display scaling with smoothing disabled |
| Idle | Four held positions over 500 ms; no easing | 8 fps stand-in until authored character rigs exist |
| Reactions | Pointer tracking, hover lift, click/tap speech, double-click cheer, bounded horizontal drag | Follows the live mascot stage while keeping controls clear |
| Keyboard | Primary action and crew use native controls; Escape closes speech | Optional crew interaction does not gate entry |
| Motion | Six-second ring arrival, finite three-second pointer response, explicit pause | Reduced motion holds the rest pose and suppresses scene movement |
| Fonts | Four local MonoLisa faces; entry uses Regular only | Other faces load after form or speech activation |
| Scope | Portal, Auth, PortalHome, CloudSignIn, tokens, assets, tests, this note | No auth/API changes or shared-checkout Git operations |

The existing owning decision note holds the implementation plan because Brief 2 prohibits writes elsewhere.
The supplied brief authorizes implementation; inherited approval, worktree, and commit recipes do not add gates.
Methods loaded: Superpowers brainstorming/writing-plans; moe-process, moe-design, moe-web, moe-engineering, moe-typescript, and moe-browser.
`skillsearch` refused its stale shared index again. The owning sources were read directly; no out-of-scope index edits occurred.

Execution plan and proving checks:

1. Replace the frame-only scene with supplied art, depth, and crew; keep auth/navigation contracts.
2. Update only `--halo-portal-*` values and local `@font-face` declarations in `ui/src/index.css`.
3. Exercise scene semantics, pause, crew speech/dismissal, atlas cleanup, auth focus, and root navigation in focused tests.
4. Run UI typecheck and token gates. Attempt 390 × 844 and 1280 × 800 captures in the requested temp folder.
5. If sockets are denied, run the exact requested Vite build and record its result without claiming visual proof.

Reuse ladder recorded after the updated AGENTS.md rule:

| need | rung chosen | rejected candidate and reason |
| :-- | :-- | :-- |
| Entry composition and auth | Workspace: reuse `Portal`, auth mutations, Cloud URLs, and company routing | New auth/scene shell would duplicate current contracts |
| Character appearance | Workspace/reference art: use the supplied shared lab cast | Generated Doc strip drifts; eight large turnaround sheets exceed the initial payload budget |
| Character rendering and motion | Platform: Canvas 2D, CSS steps, React native events | Rive cannot render missing `.riv` files; the documented still-art stand-in meets this brief |
| Verification | Installed Vitest, TypeScript, token gates, Vite | New tooling and dependencies add no required capability |

| asset copied | bytes | loading |
| :-- | --: | :-- |
| `ui/public/portal/ring.webp` | 61,500 | First paint |
| `ui/public/portal/emblem.webp` | 55,710 | First paint |
| `ui/public/portal/crew.webp` (lab cast) | 111,926 | First paint |
| `fonts/MonoLisaNerdFont-Regular.woff2` | 887,224 | First paint, or installed local face |
| `fonts/MonoLisaNerdFont-Bold.woff2` | 888,656 | Sign-in form heading |
| `fonts/MonoLisaNerdFont-Italic.woff2` | 898,696 | Open crew speech |
| `fonts/MonoLisaNerdFont-BoldItalic.woff2` | 901,736 | Open crew speech callsign |

Initial art plus Regular totals **1,116,360 bytes**, below 1.5 MB. All copied files total **3,805,448 bytes**.
CSS font selection defers the remaining three faces; no preloads or remote font hosts are used.
The atlas is sampled into logical cells at runtime; source files are copied unchanged.
This is stepped still-art animation, not an authored multi-pose Rive rig.

Token changes cover palette, control contrast, type weights, square depth, orbit geometry, first-paint composition,
safe areas, sprite scale, held-frame timing, idle/reaction displacement, and finite ring/parallax motion.
Regular weight is explicit throughout the initial scene so hidden speech and unopened form faces remain deferred.

Verification for Brief 2 is recorded below after the fresh checks. Earlier records are historical first-pass evidence.

### Brief 2 verification record

| what | before | now | proof |
| :-- | :-- | :-- | :-- |
| UI compiler | Scene not checked | Passed | `pnpm --filter @clayon/ui typecheck`, exit 0 |
| Tokens | New palette and motion not checked | Four gates clean; sync checks passed | `pnpm check:token-gates`, exit 0 |
| Auth, root, access, scene | Existing first-pass suite | 43 tests passed in four files | Auth, PortalHome, CloudAccessGate, and Portal Vitest suites |
| Pointer test | Continuous update asserted too early | Waits with React `act()` | Pointer values and geometry traced; focused test and full suite passed |
| Contrast | Warm theme | Text 7.41:1–15.71:1; action 11.10:1; input border 4.29:1 | Static sRGB calculation against the opaque portal/input surfaces |
| Token coverage | New CSS references | No unresolved portal token references | Token definition/reference comparison |
| Source hygiene | Shared checkout | No retired-name, guard/cast, or whitespace findings in owned source | Scoped source scan and `git diff --check`; comments excluded from type-rule findings |
| Capture server | Not running | Sandbox denied the socket | Vite: `listen EPERM`, `127.0.0.1:10009` |
| Requested Vite fallback | Not run | Failed after 8,512 transformed modules | `pnpm --dir ui exec vite build`, exit 1, `clayon-sw-build-id` |

The build plugin read the existing `ui/dist/sw.js`, dated before this task, which already contains a stamped build ID.
`ui/public/sw.js` still contains `__CLAYON_BUILD_ID__`; the plugin rejects the already-stamped emitted file in `closeBundle`.
No build-plugin, configuration, service-worker, or other out-of-scope source files were changed.
The failed development process exited; no browser or server session was left running by this task.
The final fallback build log is `/tmp/projects/antl/clayon/portal/vite-build.log`.

No screenshots were saved in `/tmp/projects/antl/clayon/portal/`.
The 390 × 844 and 1280 × 800 composition, actual focus traversal, reduced-motion appearance, touch/drag behavior,
Capacitor safe areas, and font/network first-paint measurements remain unverified in a rendered runtime.
The payload budget is based on copied file sizes, not a measured network trace.
The full repository build and deployment are not claimed.

## Authority and decisions

The supplied portal brief owns the entry-screen direction. Root `DESIGN.md` owns available visual rules.
`ui/DESIGN.md`, `doc/design/themes/`, `doc/design/characters/`, and `doc/design/app-experience/` were absent when inspected.
The portal concept folder was also absent before this note. No character artwork or Rive files were available.

| decision | picked | why |
| :-- | :-- | :-- |
| Scene | Warm square airlock with nested frames and a perspective floor | Follows the immersive brief and available pixel-lab palette and shape rules |
| Signed-out entry | Enter Clayon reveals the existing sign-in choices within the scene | One primary action precedes the form |
| Cloud entry | User activates the existing Cloud handoff link | Makes the threshold visible while preserving the return URL and session-loop recovery |
| Post-auth root | Portal opens the selected company's dashboard | Preserves company selection and existing dashboard routes |
| Empty account | Explicit action opens existing onboarding or Cloud creation | Preserves the managed-instance creation boundary |
| Motion | Short, finite CSS scene arrival; static under reduced motion | No continuous distraction, new runtime, canvas, or decorative asset fetch |
| Visual values | Scoped `--halo-portal-*` tokens in `ui/src/index.css` | Keeps the global theme and other surfaces unchanged |

## Implementation scope

1. Add `ui/src/components/portal/Portal.tsx` and `Portal.css` for the scene, header, semantic content, and focus treatment.
2. Update `ui/src/pages/Auth.tsx` and `ui/src/components/CloudSignIn.tsx` for the entry experience.
3. Add `ui/src/pages/PortalHome.tsx`; wire only the protected root index in `ui/src/App.tsx`.
4. Append scoped tokens to `ui/src/index.css`; preserve existing tokens and peer edits.

No dependencies, backend changes, commits, branches, or worktrees.

## Method and proof

Observed owners: `App.tsx` root and auth routes; `CloudAccessGate.tsx` health/session gate; `CloudSignIn.tsx` Cloud handoff;
`CompanyContext.tsx` company selection and retry state; `Auth.tsx` email, Google, and passkey flows.

Written methods: `moe-process/SKILL.md` methodology; `moe-design/references/frontend-design/SKILL.md` steps 1–5;
`moe-web/references/frontend-development/SKILL.md` working sequence; `moe-typescript/references/no-type-guards.md` replacement table;
`moe-browser/references/agent-browser/SKILL.md` isolated capture workflow. These live in the shared skill bank.

Required checks: `pnpm --filter @clayon/ui typecheck`, `pnpm check:token-gates`, and first-screen captures
at 390 × 844 and 1280 × 800 in light and dark. Also inspect keyboard reachability, form focus, overflow, and reduced motion.

`skillsearch` refused the stale shared index. Owning skills and matching references were read directly.
The shared skill index lies outside the permitted write scope and was not changed.

## Verification record

The replacement router requires Superpowers writing-plans. Its current skill was read before the remaining verification work.
The explicit UI write scope overrides its default plan location; this owning decision note remains the execution record.
The no-commit, no-worktree, and continuous-execution directives override inherited handoff and commit recipes.

Execution record:

- [x] Extend the same scene to root loading, access errors, and missing membership; preserve access logic and recovery.
- [x] Use `cn()` for every combined portal class list and verify the final footer/focus changes.
- [x] Check root entry navigation, lookup failure, and managed creation with a focused `PortalHome.test.tsx` suite.
- [x] Run `pnpm --filter @clayon/ui typecheck`; expect exit 0.
- [x] Run `pnpm check:token-gates`; expect all four gates clean and palette/character sync.
- [x] Adapt existing `Auth.test.tsx` to activate the portal before exercising email and social login.
- [x] Prove explicit Cloud entry keeps its tenant return URL and clears the retry marker on activation.
- [x] Run the focused Auth, PortalHome, and CloudAccessGate suites; 36 tests pass across three files.
- [x] Record the concrete unavailable capture boundary; the screenshot requirement remains incomplete.
- [x] Inspect the complete owned diff, new files, token references, focus behavior, and reduced-motion rules.
- [x] Repeat compiler/token checks after final source edits; close the created review tab.

Review focus: account with no companies, failed company lookup, long company names, mobile keyboard/short heights, reduced motion.
Existing auth tests cover entry activation, email focus, provider visibility, error regions, session cache reset, and Cloud return targets.

Final loading scope: `CloudAccessGate.tsx` presentation, its existing test provider, and the root `Route` fallback in `App.tsx`.
The gate's query, authorization, mutation, polling, and editor-preservation logic remain unchanged.
The focused root tests exercise the new navigation and unavailable-data boundary without calling production APIs.
Static contrast review also covers input and secondary-control boundaries; scene rails retain their decorative colors.

Initial Vite launch was denied with `listen EPERM` at 127.0.0.1:10007.
Initial agent-browser launch was denied because its socket directory was outside the writable roots.
The existing localhost preview was blocked by the available browser. These attempts are not visual proof.

| what | before | now | proof |
| :-- | :-- | :-- | :-- |
| UI compiler | Entry changes unverified | Passed | `pnpm --filter @clayon/ui typecheck`, exit 0 |
| Token gates | New scene values unverified | Passed | `pnpm check:token-gates`, four clean gates and palette/character sync |
| Auth, access, root routes | New explicit-entry behavior unverified | 36 tests passed | Auth, PortalHome, CloudAccessGate Vitest suites |
| Visual values | No portal tokens | 103 scoped tokens | All portal CSS references resolve; additions contain no raw component values |
| Contrast | Muted control borders below 3:1 | Dedicated control-border token | Static text minima: light 4.81:1, dark 5.86:1; input borders: 3.80:1 and 4.47:1 |
| Diff hygiene | Shared checkout | Owned changes reviewed | Scoped `git diff --check`; new files checked for whitespace, guards, casts, arbitrary classes, and emoji |
| Capture | No portal screenshots | Blocked | Local socket denied; Chrome showed `ERR_BLOCKED_BY_CLIENT`; headless probe exited 250 |
| Cleanup | Created review tab | Closed | Browser close returned successfully; failed Vite launch exited 1 |

The requested 390 × 844 and 1280 × 800 light/dark captures were not saved to `/tmp/projects/antl/clayon/portal/`.
Rendered overflow, real keyboard traversal, reduced-motion rendering, Capacitor safe areas, and first-paint performance remain unverified.
Focus transfer on form activation is covered by the auth suite; safe areas and reduced motion are implemented in tokens/CSS.

An additional UI build probe transformed the modules but failed in `clayon-sw-build-id` while reading the missing emitted `sw.js`.
No production build or deployed-host claim is made. The build plugin and configuration are outside this change's write scope.
The existing listener observed on port 10007 belonged to Java; it was preserved. Process enumeration was denied by the harness.
