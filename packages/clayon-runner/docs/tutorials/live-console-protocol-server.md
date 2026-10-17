---
id: antl:clayon/packages/clayon-runner/docs/tutorials/live-console-protocol-server
---

# Live console: Run the Protocol Demo Server

## What this is

Runs the Live console server layer. No browser UI yet; `curl`
acts as the browser.

Server starts Codex. Codex login data stays server-side. JSON replies
must contain no Clayon key, no OpenAI key, no bearer value.

## Step 1: Run deterministic checks

From the repository root:

```sh
bun x vitest run \
  src/drivers/codex/codex-app-server-driver.test.ts \
  src/mock-core/live-console-demo-server.test.ts
```

Expected: both files pass. Tests cover requests, goals, lineage,
steering, interrupt races, reconnect, replay, redaction.

## Step 2: Start the server

Use an empty directory outside your Codex home:

```sh
liveConsole_workspace="$(mktemp -d)"
bun run --filter @clayon/clayon-runner demo:live-console -- \
  --host 127.0.0.1 \
  --port 4174 \
  --working-directory "$liveConsole_workspace"
```

Keep this terminal open. First output line is JSON: host,
port, server-owned working directory, plus
`"credentialsExposed":false`.

## Step 3: Check the boundary

In a second terminal, run:

```sh
curl -s http://127.0.0.1:4174/api/liveConsole/health \
  -H 'Origin: http://127.0.0.1:4174' \
  -H 'Sec-Fetch-Site: same-origin' | jq
```

Expected facts:

- `status` is `ok`;
- `boundary` is `package-local-mock-core`;
- `providerAuthentication` is `server-side`; and
- `credentialsExposed` is `false`.

## Step 4: Start one safe session

```sh
curl -s -X POST http://127.0.0.1:4174/api/liveConsole/sessions \
  -H 'Origin: http://127.0.0.1:4174' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'content-type: application/json' \
  --data '{"objective":"Create demo.txt with exactly: liveConsole demo","message":"Complete and verify the exact file task."}' \
  | tee "$liveConsole_workspace/session.json" | jq
```

Copy `sessionId` and `activeTurnId` from the reply. Server ignores a
browser-supplied working directory; rejects browser-supplied credential
fields.

## Step 5: Read live or replayed events

```sh
session_id="$(jq -r .sessionId "$liveConsole_workspace/session.json")"
curl -s "http://127.0.0.1:4174/api/liveConsole/sessions/$session_id/events?after=0" \
  -H 'Origin: http://127.0.0.1:4174' \
  -H 'Sec-Fetch-Site: same-origin' | jq
```

Reply contains canonical PRP events plus a cursor. Later requests pass
that cursor as `after`. Same events go through the same reducer in live
view and replay.

For a live stream, run:

```sh
curl -N "http://127.0.0.1:4174/api/liveConsole/sessions/$session_id/stream?after=0" \
  -H 'Origin: http://127.0.0.1:4174' \
  -H 'Sec-Fetch-Site: same-origin'
```

## Step 6: Reconnect the same session

```sh
curl -s -X POST \
  "http://127.0.0.1:4174/api/liveConsole/sessions/$session_id/reconnect" \
  -H 'Origin: http://127.0.0.1:4174' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'content-type: application/json' --data '{}' | jq
```

Confirm `runId`, `normalizedSessionId`, `driverSessionId`,
`providerSessionId` unchanged. New events include `session.resumed`.

Repeated browser headers are intentional admission evidence. Rejected:
DNS-rebinding
Hosts, cross-origin or missing Fetch Metadata, wildcard binds, simple
`text/plain` mutations. This protects the browser boundary; untrusted local
processes can still make loopback requests. Codex sandbox and
approval policy remain the final execution boundary.
