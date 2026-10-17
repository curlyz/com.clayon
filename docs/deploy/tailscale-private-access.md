---
id: antl:clayon/docs/deploy/tailscale-private-access
title: Tailscale Private Access
summary: Run Clayon with Tailscale-friendly bind presets and connect from other devices
---

Use this to access Clayon over Tailscale (or a private LAN/VPN) instead of only `localhost`.

## 1. Start Clayon in private authenticated mode

```sh
bun run dev --bind tailnet
```

Recommended behavior:

- `CLAYON_DEPLOYMENT_MODE=authenticated`
- `CLAYON_DEPLOYMENT_EXPOSURE=private`
- `CLAYON_BIND=tailnet`

If you want the old broad private-network behavior instead, use:

```sh
bun run dev --bind lan
```

Legacy aliases still map to `authenticated/private + bind=lan`:

```sh
bun run dev --authenticated-private
bun run dev --tailscale-auth
```

## 2. Find your reachable Tailscale address

From the machine running Clayon:

```sh
tailscale ip -4
```

Your Tailscale MagicDNS hostname also works (for example `my-macbook.tailnet.ts.net`).

## 3. Open Clayon from another device

Tailscale IP or MagicDNS host plus the Clayon port:

```txt
http://<tailscale-host-or-ip>:3100
```

Example:

```txt
http://my-macbook.tailnet.ts.net:3100
```

## 4. Allow custom private hostnames when needed

Custom private hostname: add it to the allowlist:

```sh
npx clayon allowed-hostname my-macbook.tailnet.ts.net
```

## 5. Verify the server is reachable

From a remote Tailscale-connected device:

```sh
curl http://<tailscale-host-or-ip>:3100/api/health
```

Expected result:

```json
{"status":"ok"}
```

## Troubleshooting

- Login or redirect errors on a private hostname: add it with `clayon allowed-hostname`.
- App only works on `localhost`: make sure you started with `--bind lan` or `--bind tailnet` instead of plain `bun run dev`.
- Can connect locally but not remotely: verify both devices are on the same Tailscale network and port `3100` is reachable.
