# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e

# Keep the Rust toolchain explicit so the runner artifact is reproducible and
# is always built for the same platform as the final Daytona image. Base-image
# digests are the reviewed linux/amd64 manifests; the tags are annotations.
FROM rust:1.97-bookworm@sha256:408fe88047cef61a2087653b0c5255fa51c0f2d6d94ddedd7a2562a9b91a46f6 AS runnerd-build

WORKDIR /workspace/packages/clayon-runner/runner
COPY packages/clayon-runner/runner/Cargo.toml packages/clayon-runner/runner/Cargo.lock ./
COPY packages/clayon-runner/runner/crates ./crates
COPY packages/clayon-runner/protocol ../protocol
RUN cargo build --locked --release -j 2 -p clayon-runner-core --bin clayon-runnerd \
    && strip /workspace/packages/clayon-runner/runner/target/release/clayon-runnerd

FROM node:24.21.0-bookworm@sha256:5a750d3be5e5c80275f8c9a5367c3aed99c2875656590c8d0701c7ee687f5f0a AS provider-pack-build
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
# Bound build-time memory on hosts that expose many CPUs but little RAM.
# These settings belong only to this build stage, never the runtime image.
ENV NODE_OPTIONS=--max-old-space-size=1024 \
    npm_config_child_concurrency=1 \
    npm_config_network_concurrency=4
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY patches ./patches
COPY scripts/link-plugin-dev-sdk.mjs ./scripts/link-plugin-dev-sdk.mjs
# Include the complete workspace manifest graph so source-owned patches apply.
# Verify the reviewed lockfile as supplied; never resolve dependencies again
# against the registry during an immutable image build.
COPY packages ./packages
COPY server/package.json ./server/package.json
COPY ui/package.json ./ui/package.json
COPY cli/package.json ./cli/package.json
# The complete resolved lock (including transitive integrity hashes) is reviewed.
# Reject registry-time drift BEFORE installing packages or running lifecycle code.
# Refresh this digest together with source/provider dependency changes.
ARG CLAYON_RUNNER_LOCK_SHA256=440f0ccd8a383b32a576dc53b4191d73bb03a91ba0dabfa1c3d79c3039e01aa5
# pnpm 9 subtracts PNPM_WORKERS from available CPUs; it is not a worker count.
# Subtract all available CPUs to select its minimum (one tarball worker).
RUN export PNPM_WORKERS="$(node -p 'require("node:os").availableParallelism()')" \
    && printf '%s  pnpm-lock.yaml\n' "${CLAYON_RUNNER_LOCK_SHA256}" > /tmp/provider-lock.sha256 \
    && sha256sum -c /tmp/provider-lock.sha256 \
    && pnpm install --frozen-lockfile --filter '@clayon/clayon-runner...'
ARG CLAYON_RUNNER_SOURCE_REVISION
# Optional qualification assets; this never promotes candidate profiles.
ARG CLAYON_RUNNER_CANDIDATE_PROVIDERS=
RUN test -n "${CLAYON_RUNNER_SOURCE_REVISION}"
RUN export PNPM_WORKERS="$(node -p 'require("node:os").availableParallelism()')" \
    && pnpm --filter @clayon/clayon-runner build:typescript \
    && CLAYON_RUNNER_SOURCE_REVISION="${CLAYON_RUNNER_SOURCE_REVISION}" \
      node packages/clayon-runner/scripts/build-provider-pack.mjs /provider-pack \
        "--candidate-providers=${CLAYON_RUNNER_CANDIDATE_PROVIDERS}" \
    && chmod -R a+rX /provider-pack

# Fleet sandbox base image. Keep this section aligned with
# clayon/clayon-cloud/fleet-sandbox-image/Dockerfile. The only Clayon
# runner-specific addition is /usr/local/bin/clayon-runnerd below.
FROM daytonaio/sandbox:0.8.0@sha256:eadf88e4391072b7ad4bed27d9cadfc9fe9d8ed375d9219d34c2ccb518f213e3

USER root

ENV CLAYON_RUNNER_PROVIDER_PACK_ROOT=/opt/clayon-runner/provider-pack
ENV PATH=${CLAYON_RUNNER_PROVIDER_PACK_ROOT}/node_modules/.bin:/usr/local/share/nvm/current/bin:/usr/local/python/current/bin:/usr/local/py-utils/bin:${PATH}

# Share the pack's latest stable Codex, Claude and OpenCode with every adapter.
# Never add a second CLI version to work around a runner compatibility pin.
RUN npm uninstall -g @anthropic-ai/claude-code @openai/codex opencode-ai \
    && npm install -g \
      @xai-official/grok@1.0.46 \
      @google/gemini-cli@0.62.0 \
      @moonshot-ai/kimi-code@2.1.1 \
    && npm cache clean --force

# Hermes requires Python >=3.11,<3.14; the image's default Python is newer.
# Use the distro interpreter in a dedicated environment without changing PATH
# or keeping an older Hermes CLI. Everything is installed before sandbox boot.
# Debian 13 in the sandbox base already includes Python 3.13 and python3-venv.
RUN /usr/bin/python3 -m venv /opt/hermes \
    && /opt/hermes/bin/pip install --no-cache-dir hermes-agent==0.19.0 \
    && ln -sf /opt/hermes/bin/hermes /usr/local/bin/hermes

ARG CURSOR_VERSION=2026.10.01-e373342
ARG CURSOR_SHA256_AMD64=a79726c6e644520e993970be4c45775a6889802b67abe461a677a53219ae28e8
RUN set -eu; \
    arch="$(dpkg --print-architecture)"; \
    [ "$arch" = "amd64" ] || { echo "FATAL: cursor pin only covers amd64, not $arch" >&2; exit 1; }; \
    dir="/opt/cursor/versions/${CURSOR_VERSION}"; mkdir -p "$dir"; \
    curl -fsSL "https://downloads.cursor.com/lab/${CURSOR_VERSION}/linux/x64/agent-cli-package.tar.gz" -o /tmp/cursor.tgz; \
    printf '%s  /tmp/cursor.tgz\n' "${CURSOR_SHA256_AMD64}" > /tmp/cursor.sha256; \
    sha256sum -c /tmp/cursor.sha256; \
    tar --strip-components=1 -xzf /tmp/cursor.tgz -C "$dir"; \
    rm -f /tmp/cursor.tgz /tmp/cursor.sha256; \
    ln -sf "$dir/cursor-agent" /usr/local/bin/cursor-agent; \
    ln -sf /usr/local/bin/cursor-agent /usr/local/bin/agent; \
    chmod -R a+rX /opt/cursor

ARG GH_VERSION=2.102.0
ARG GH_SHA256_AMD64=bb766f710eef8ede859c18578c72c327597cd4c8a85b06001b1f3843c6019386
RUN set -eu; \
    arch="$(dpkg --print-architecture)"; \
    [ "$arch" = "amd64" ] || { echo "FATAL: gh pin only covers amd64, not $arch" >&2; exit 1; }; \
    curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz" -o /tmp/gh.tgz; \
    printf '%s  /tmp/gh.tgz\n' "${GH_SHA256_AMD64}" > /tmp/gh.sha256; \
    sha256sum -c /tmp/gh.sha256; \
    tar -xzf /tmp/gh.tgz -C /tmp; \
    install "/tmp/gh_${GH_VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh; \
    rm -rf /tmp/gh.tgz /tmp/gh.sha256 "/tmp/gh_${GH_VERSION}_linux_amd64"

COPY packages/clayon-runner/scripts/provision-grok.mjs /tmp/grok-provision/scripts/provision-grok.mjs
COPY packages/clayon-runner/src/providers/grok/platforms.json /tmp/grok-provision/src/providers/grok/platforms.json
RUN node /tmp/grok-provision/scripts/provision-grok.mjs /opt/clayon/providers/grok/1.0.13/grok && rm -rf /tmp/grok-provision

COPY --from=runnerd-build /workspace/packages/clayon-runner/runner/target/release/clayon-runnerd /usr/local/bin/clayon-runnerd
COPY --from=provider-pack-build /provider-pack /opt/clayon-runner/provider-pack
RUN set -eu; for cli in codex claude opencode; do \
      printf '#!/bin/sh\nexec /opt/clayon-runner/provider-pack/node_modules/.bin/%s "$@"\n' "$cli" > "/usr/local/bin/$cli"; \
      chmod 755 "/usr/local/bin/$cli"; \
    done

# Keep revision-dependent metadata below the stable agent CLI installation
# layers. A source-only image miss can then reuse those expensive layers from
# the trusted registry cache.
ARG CLAYON_RUNNER_CONTENT_ID
ARG CLAYON_RUNNER_SOURCE_REVISION
RUN test -n "${CLAYON_RUNNER_CONTENT_ID}" \
    && test -n "${CLAYON_RUNNER_SOURCE_REVISION}"

RUN set -eu; \
    printf '%s\n' 'export PATH=/opt/clayon-runner/provider-pack/node_modules/.bin:$PATH' \
      > /etc/profile.d/01-clayon-runner-provider-pack.sh; \
    chmod 0644 /etc/profile.d/01-clayon-runner-provider-pack.sh; \
    for command_name in acpx claude-agent-acp codex-acp claude codex grok gemini kimi opencode cursor-agent agent hermes gh clayon-runnerd; do \
      command -v "$command_name" >/dev/null || { echo "FATAL: $command_name not on PATH after build" >&2; exit 1; }; \
    done; \
    metadata="$(clayon-runnerd --build-metadata)"; \
    /opt/clayon-runner/provider-pack/node_modules/node/bin/node -e "const [major,minor,patch]=process.versions.node.split('.').map(Number); if (major<24 || (major===24 && (minor<11 || (minor===11 && patch<0)))) process.exit(1)"; \
    test -f /opt/clayon-runner/provider-pack/provider-pack.json; \
    printf '%s' "$metadata" | grep -q '"dial_ws_loopback"'; \
    printf '%s' "$metadata" | grep -q '"dial_wss"'; \
    printf '%s' "$metadata" | grep -q '"listen_ws"'; \
    echo "all agent CLIs and runnerd transport modes are available"

USER daytona

RUN /bin/sh -lc 'set -eu; \
    test -r /opt/clayon-runner/provider-pack/provider-pack.json; \
    /opt/clayon-runner/provider-pack/node_modules/node/bin/node -e \
      "JSON.parse(require(\"node:fs\").readFileSync(\"/opt/clayon-runner/provider-pack/provider-pack.json\", \"utf8\"))"; \
    for command_name in acpx claude-agent-acp codex-acp; do \
      command -v "$command_name" >/dev/null || { echo "FATAL: $command_name not on PATH for daytona user" >&2; exit 1; }; \
    done; \
    test "$(codex --version)" = "codex-cli 0.160.0"; \
    test "$(claude --version)" = "2.1.286 (Claude Code)"; \
    test "$(opencode --version)" = "1.18.34"; \
    test "$(acpx --version)" = "0.13.1"; \
    test "$(claude-agent-acp --version)" = "0.73.0"; \
    test "$(codex-acp --version)" = "@agentclientprotocol/codex-acp 1.6.2"'

LABEL io.clayon.runner.content-id="${CLAYON_RUNNER_CONTENT_ID}" \
      org.opencontainers.image.revision="${CLAYON_RUNNER_SOURCE_REVISION}"
