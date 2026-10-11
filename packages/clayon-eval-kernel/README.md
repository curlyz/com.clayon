# Clayon Eval Kernel

`@clayon/clayon-eval-kernel` is the workspace-private, provider-neutral
matrix orchestrator owned by Clayon Evals. It contains no Clayon scenario
corpus, provider configuration, product fixture, scorer, or report template.

Consumers pass scenario and candidate values plus execution and scoring
callbacks. Candidate `preflight` hooks should call the runner package's
`assertClayonRunnerCompatibility` before any provider work starts. This keeps
catalog, protocol, runner-client, control-plane-adapter, testkit, corpus, and
provider-operation incompatibilities explicit.

Clayon App may consume this package only as a development dependency for CI
or parity tests. `@clayon/clayon-runner` has no runtime dependency on it.
