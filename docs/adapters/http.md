---
id: antl:clayon/docs/adapters/http
title: HTTP Adapter
summary: HTTP webhook adapter
---

The `http` adapter sends a webhook request to an external agent service. The agent runs externally and Clayon just triggers it.

## When to Use

- Agent runs as an external service (cloud function, dedicated server)
- Fire-and-forget invocation model
- Integration with third-party agent platforms

## When Not to Use

- If the agent runs locally on the same machine (use `process`, `claude_local`, or `codex_local`)
- If you need stdout capture and real-time run viewing

## Configuration

- **`url`** — string, required — Webhook URL to POST to
- **`headers`** — object, optional — Additional HTTP headers
- **`timeoutSec`** — number, optional — Request timeout

## How It Works

1. Clayon sends a POST request to the configured URL
2. The request body includes the execution context (agent ID, task info, wake reason)
3. The external agent processes the request and calls back to the Clayon API
4. Response from the webhook is captured as the run result

## Request Body

The webhook receives a JSON payload with:

```json
{
  "runId": "...",
  "agentId": "...",
  "companyId": "...",
  "context": {
    "taskId": "...",
    "wakeReason": "...",
    "commentId": "..."
  }
}
```

The external agent uses `CLAYON_API_URL` and an API key to call back to Clayon.
