# RFC 001: Memory-safe local model evaluation

- **Status:** Proposed; blocks 27B acceptance runs
- **Date:** 2026-07-14
- **Owner:** Repository maintainer
- **Related incident:** [INC-2026-07-14-MLX-001](../incidents/2026-07-14-mlx-gpu-kernel-panic.md)

## Problem statement

The current harness sends Hermes conversations directly to `mlx_lm.server`. The installed server can accept arbitrarily large prompts but does not expose a server-side maximum KV-cache size. On a 24 GiB unified-memory workstation, a 44,960-token agent turn using Ternary Bonsai 27B triggered an Apple GPU-driver kernel panic and rebooted the machine.

[PM COMMENT] Local inference is valuable only if the economic-job demonstration does not put the operator's entire workstation at risk. A completed brief is not worth an uncontrolled kernel-level failure mode.

[PRE-MORTEM] If prompt guidance is the only control, a verbose web result or a model recovery loop will eventually bypass it and recreate the incident.

## Goals and non-goals

Goals:

- enforce a deterministic safe envelope before a request reaches MLX;
- leave enough unified memory for macOS and foreground applications;
- preserve observable Hermes tool use and local-model inference;
- fail closed with useful evidence instead of continuing under uncertain pressure;
- establish the largest safe context through staged measurement, not model-card limits.

Non-goals:

- claiming that software controls fix Apple's `IOGPUFamily` bug;
- demonstrating the model's theoretical maximum context on this machine;
- silently falling back to a remote model during acceptance;
- lowering the research source-quality bar.

[PM COMMENT] The source bar stays fixed. If five sources cannot fit in one safe turn, the workflow must use bounded collection and synthesis stages.

## Proposed decision

1. Keep 27B acceptance runs disabled until the incident's A1–A5 controls pass.
2. Put a local request guard between Hermes and MLX. Reject requests above both an input-token ceiling and a serialized-byte ceiling before forwarding.
3. Start with a conservative canary ceiling no higher than 8,000 input tokens. Raise it only through the staged test matrix; never exceed the largest measured-safe tier.
4. Replace the direct `mlx_lm.server` entry point with a small wrapper that sets supported `mlx.core.metal` cache, memory, and wired limits before importing the server.
5. Reduce evaluation defaults to one prompt cache, a small prompt-cache byte allowance, and at most 2,048 generated tokens until canaries prove a larger envelope.
6. Record active, cache, and peak Metal memory at startup and around every request. Terminate the evaluation before the reserved OS headroom is consumed.
7. Bound web evidence at ingestion: small search result counts, no broad parallel fan-out, selected fetches, and compact claim/source notes passed to synthesis.
8. Split the job into bounded collection and synthesis sessions when the evidence packet would exceed the proven context tier.

[PM COMMENT] Exact Metal limits are configuration produced by canary evidence, not magic constants copied from a different Mac. The wrapper must refuse unset or internally inconsistent values.

[PRE-MORTEM] A limit that is logged but not enforced will be ignored under deadline pressure. Every limit needs a rejection or termination test.

## SDLC guardrails

### CI checks

- Shell/static test: server startup cannot invoke `mlx_lm.server` directly in evaluation mode.
- Unit test: byte and token fixtures immediately below and above the configured ceilings pass and fail deterministically.
- Unit test: missing memory-limit configuration fails startup.
- Unit test: source payload compaction preserves URL, publisher, date, source type, claim, and limitation fields.
- Repository test: monthly acceptance traces must include the effective safety configuration and maximum observed request size.

CI cannot exercise Metal safely on GitHub-hosted runners. It verifies configuration and guard logic; the release check supplies hardware evidence.

### Release checks

- Record Mac model, unified memory, macOS build, MLX version, MLX-LM version, model revision, and model checksum.
- Run isolated 2k, 4k, 8k, and optionally 12k input canaries, one at a time.
- For each tier, record request bytes/tokens, generated tokens, active/cache/peak Metal memory, process RSS, swap delta, duration, and result.
- Stop immediately on a Metal error, unexpected swap acceleration, UI instability, memory-limit breach, or panic. A stopped tier is not retried at the same settings.
- A human operator explicitly approves the largest safe tier before monthly acceptance begins.

### Ownership

- The repository maintainer owns guard implementation and CI.
- The human operator owns hardware canary approval.
- The evaluation trace author owns evidence completeness.
- Any kernel panic returns the RFC to `Proposed`, disables 27B runs, and opens a new incident occurrence.

### Evidence requirements

An accepted January or February trace must include:

- effective input-token, request-byte, output-token, prompt-cache, Metal cache, Metal memory, and wired-memory limits;
- highest request size and observed memory peak;
- proof the local pinned model served the request;
- all rejected/compacted tool payloads;
- clean server and Hermes exit states; and
- a link to the signed canary record for this exact dependency/OS configuration.

[PRE-MORTEM] If the canary record is reusable across upgraded macOS, MLX, or model builds, a changed allocator can escape the tested envelope. Any one of those changes invalidates the canary.

## Incident mapping

| Incident condition | Enforced control |
| --- | --- |
| 44,960-token request reached MLX | Token and byte gate rejects above canary-proven ceiling |
| Three parallel searches returned ~147k characters | Evidence-ingestion budget and no broad parallel fan-out |
| Server lacked `--max-kv-size` | Proxy request ceiling plus wrapper memory limits; do not claim a nonexistent flag |
| Short smoke was treated as sufficient | Staged hardware canary and human approval |
| No warning preceded the kernel panic | Per-request memory telemetry and abort threshold |
| Server was restarted after reboot | Panic-triggered no-go state blocks startup until incident review |

[PM COMMENT] Closure is a concrete path: implement guards, test rejection, run staged canaries, approve one envelope, then rerun both monthly jobs inside it.

## Rollout plan

### Phase 1: Containment

- Keep all 27B processes stopped.
- Commit the incident and this RFC.
- Preserve raw traces locally; do not publish fetched full-text bodies.

### Phase 2: Enforcement

- Implement the launch wrapper, request guard, telemetry, and tests.
- Make unsafe direct startup fail with a clear error.
- Add the safety configuration to trace templates.

### Phase 3: Canary and acceptance

- Run the staged isolated canary.
- Freeze the approved envelope for the current OS/dependency/model tuple.
- Rerun January and February with bounded evidence collection.
- Revoke the envelope after any relevant version change or instability.

## Success metrics

- 100% of local 27B requests pass through token and byte enforcement.
- 100% of acceptance traces record effective limits and peak memory.
- 0 direct `mlx_lm.server` evaluation launches.
- 0 repeated kernel panics.
- Oversized-request fixtures are rejected before any MLX allocation.
- January and February complete within the measured-safe envelope without lowering their source bar.

## Risks and tradeoffs

| Risk | Mitigation |
| --- | --- |
| Conservative ceilings reduce synthesis quality | Split collection from synthesis and pass compact claim/source records |
| Memory APIs may not prevent an Apple driver bug | Treat limits as risk reduction, retain no-go and staged canary controls |
| Token counting differs from the server tokenizer | Enforce both serialized bytes and model-token estimates with safety margin |
| Prompt-only search limits drift | Enforce payload budgets outside the model |
| Canary success creates false confidence | Bind approval to exact hardware, OS, MLX, MLX-LM, model revision, and configuration |

## Decision requested

Approve the following before resuming 27B work:

1. The kernel panic is a release-blocking safety incident.
2. The guarded proxy/wrapper is mandatory, not optional.
3. The initial canary ceiling is at most 8k input tokens.
4. January and February may resume only after a human-reviewed hardware canary passes.
