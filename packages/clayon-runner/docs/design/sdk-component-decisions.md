---
id: antl:clayon/packages/clayon-runner/docs/design/sdk-component-decisions
---

# SDK Extraction Decision Record

Date: 2026-08-08
Status: implemented

## Outcome

Accepted Live console transport and reducer contracts copied into the
versioned `0.1.2` public surface. Reference console plus one deliberately
small second consumer import only public package subpaths. Live console and
Replay–3 stay the comparison baseline.

## Promoted contracts

Promoted: framework-free client, `useRunnerConsole`,
all approved primitives and protocol views, `RunnerConsoleApp`. Reducer
state and canonical events remain the only rendering authority. File, tool,
plan, terminal, failure, request, goal, lineage, connection, and replay views
keep no private protocol state.

Package exports `.`, `./browser`, `./react`, `./styles.css`. React and
React DOM are peers; surface adds zero runtime dependencies.

## Extension surface

Exactly five approved extension points:

1. item-body renderer;
2. request-detail renderer;
3. Composer leading and trailing slots;
4. scoped `--pcr-*` token overrides;
5. Fetch/EventSource/base-URL transport injection.

Mini consumer demonstrates all five. No new extension registry or
headless contract added.

## Kept out

Markdown `Response`, highlighted `CodeBlock`, persistent Context meter,
command palette, headless distribution, dark mode, Tailwind/Radix, toasts,
transcript virtualization stay rejected per the approved
plan. Default text and `<pre>` output keep protocol evidence inspectable;
consumers opt into rich item bodies through the one renderer contract.

## Implementation findings

- Hook must not deduplicate event IDs. Exact duplicate delivery is
  reducer input; shared reducer stays the sole duplicate authority.
- Node types needed only for browser-test and Vite configuration. Not part
  of browser runtime or public dependency surface.
- Token enforcement inspects CSS custom-property definitions plus
  component usage. `pcr-` namespace enforced across SDK sources.
- Reference console renders one React tree, selected at the 900px
  breakpoint. Two trees would duplicate landmarks, test IDs, live regions.
- Compact layout keeps transcript and composer primary.
  One accessible Menu opens session controls or protocol inspector in
  a modal panel; secondary controls never replace or duplicate the chat tree.
- A real provider may explicitly disable goals. Consumer gates buttons on
  that capability and preserves the upstream diagnostic instead of emulating
  a goal.
- Real-provider steering timing is no stable visual fixture. Fake-driver
  tests own race coverage; one safe real completion owns transport, identity,
  redaction, reconnect, replay evidence.
- Minimal hosts may lack Playwright shared libraries. Package rootless
  helper runs the same browser commands from a run-owned cache.
- Assistant text uses canonical reducer text, reveals queued additions
  progressively at character level. Reduced-motion clients get the
  complete current text immediately; protocol events and replay unchanged.
- Completed assistant item containing a semantic result JSON object shows
  summary and disposition as primary agent response. Completion checks,
  remaining work, exact protocol JSON sit behind a `Completion details`
  disclosure; protocol inspector keeps exposing the full event
  record.
- Transcript follow mode anchors the latest settled assistant response, not
  terminal or diagnostic events appended after it. Complete ordered
  transcript stays available below the response; manual scrolling still
  disengages follow mode.

## Compatibility rule

`0.1.2` is the current frozen SDK surface. Any later removal or semantic change
to an export, hook field, component prop, `data-slot`, extension point, or
token needs a versioned compatibility decision. Additive protocol fields stay
forward-compatible; schema and shared reducer stay authoritative.

## Direct chat presentation

Reference console opens in normal Codex chat mode. This mode sends plain
user text and permits follow-up turns in the same provider thread. No
Codex task envelope, semantic completion tools, or output schema.

Workspace sandbox and server-only provider authentication stay active.
Deterministic Codex fixtures stay selectable for protocol tests. Chat
layout drops decorative panel outlines; protocol inspector stays
available on demand. Header includes package version and iteration
emoji so a reviewer can identify the deployed build.

## Terminal diagnostics and responsive wrapping

`TranscriptItemEntry.debugEvents` is an additive, optional projection of
canonical item events already retained by the client. `ToolItem` shows this
data in a nested folded disclosure, no second diagnostic
model. Long commands, payloads, assistant text wrap within the center
column; mobile layouts keep every transcript descendant intrinsically
shrinkable so the page gains no horizontal scrollbar.
