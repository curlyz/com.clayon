---
id: antl:clayon/packages/clayon-runner/docs/tutorials/sdk-console
---

# SDK: Run the SDK Console and Mini Consumer

## What this phase is

SDK makes the accepted browser tracer reusable: browser client,
React hook, reusable components, one reference console, one small second
consumer.

Both apps use public package imports; neither imports the old demo UI.
Provider credentials stay in the local server.

Reference console starts in **Regular chat** mode. Type a message in the
composer to create a direct Codex session. **Protocol inspector** shows
the event stream and reducer state. Select another flow only for a
deterministic protocol fixture.

## What this phase proves

A second app can use the SDK without a private
import. Live events and replay events reduce to the same
state. Run every hard state with the fake driver, then a
safe turn with your real local Codex login.

Run commands from the repository root.

## 1. Run the small SDK tests

```sh
pnpm --filter @clayon/clayon-runner test:sdk
pnpm --filter @clayon/clayon-runner check:browser-tokens
pnpm --filter @clayon/clayon-runner check:forbidden-imports
```

These tests check reducer parity, components, tokens, and package boundaries.

## 2. Open both apps with the fake driver

```sh
pnpm --filter @clayon/clayon-runner console:sdk
```

Open these pages:

- `http://127.0.0.1:4181/reference-console/`
- `http://127.0.0.1:4181/mini-consumer/`

Page header shows `🖇️ v0.1.2`; marker confirms this iteration.

Fake driver is the default; needs no provider login.

## 3. Check the reference console

Use the manifest list. Run these flows:

1. Run **Completion**. Read the streaming and terminal messages.
2. Expand a **Terminal** row, then **Debug details**. Confirm the folded
   section contains canonical event metadata and provider payloads for the
   command without leaving the chat transcript.
   Assistant text reveals progressively. For a real Codex semantic
   completion, read the clear summary first, expand **Debug payload** for
   the exact structured JSON.
3. Run **Same-turn steering**. Type a new message while the turn is active.
   The button says **Steer**. Check the acknowledgement.
4. Run each interrupt flow. Confirm that the visible outcome names the race.
5. Run **Command and file approvals**. Resolve one request. Confirm that the
   card locks after the first click and later shows the canonical result.
6. Run **Goal lifecycle**. Set and clear the goal from the Goal menu.
7. Press **Drop connection**. Watch reconnect and gap recovery use the same
   session.
8. Enter replay. Step with Left and Right. Confirm the inspector says the
   replay matches live state.
9. Run **Item and turn failure**. Confirm that the exact server diagnostic is
   part of the transcript.

Clear response presents canonical provider output, not a
second result model. Raw event stream stays in **Protocol inspector**.

Resize the browser to 390 by 844. Chat and composer stay primary.
**Menu** reaches session controls, protocol inspector,
replay. App must not create a second hidden transcript or a horizontal page
scrollbar.

## 4. Check the mini consumer

Mini app is intentionally small. Run a turn, steer, stop, resolve a
request, set and clear a goal, drop the connection, enter replay.

Look for these proof points:

- **Mini renderer** shows the custom item-body renderer.
- **Mini detail** shows the custom request-detail renderer.
- Set goal and Clear goal use the two Composer slots.
- The blue accent is a local `--pcr-*` token override.
- Fetch and EventSource are injected by the app.
- **Replay parity: match** appears after durable history is complete.

Real driver says goals unavailable: both goal buttons stay
disabled. Correct. The SDK must not pretend the provider supports a
feature.

## 5. Run the browser acceptance tests

On a machine with Playwright system libraries:

```sh
pnpm --filter @clayon/clayon-runner test:browser:sdk
```

On a minimal Debian or Ubuntu machine without root access:

```sh
cd packages/clayon-runner
bash scripts/verify-rootless-linux.sh pnpm run test:browser:sdk
```

This runs keyboard, accessibility, reconnect, gap-recovery, replay, fake
driver, viewport measurement, and screenshot checks.

## 6. Run a real Codex session

Use a machine where the local Codex CLI is already authenticated.

```sh
cd packages/clayon-runner
bash scripts/verify-rootless-linux.sh pnpm run record:sdk:codex
```

Test runs a safe completion through both public consumers. Checks that
the browser contains no bearer token or `auth.json` path. Mini consumer
then drops and reconnects the transport, enters replay, confirms parity.

Real provider timing never proves every race. Deterministic fake
driver proves steering, interrupt, requests, goal branches. Real run
proves the same public transport and identity boundary against Codex.

## 7. Run the package acceptance command

```sh
pnpm --filter @clayon/clayon-runner verify
```

Use `verify:rootless` if the host needs package-local browser libraries.

## Expected result

All commands exit status 0. Fake and real apps use public imports.
Reconnect keeps run, session, provider identity. Replay reports `match`.
Provider credentials appear nowhere in browser state, DOM text, events,
diagnostics.
