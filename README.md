# MBIQ Hermes research agent

A small, local-first research desk for Meanwhile Back in Queens. Hermes is the agent harness, Ternary Bonsai 27B is the local model, Exa supplies web search and page fetch, and the output is a source-backed research brief for a human editor.

## What is ready

- Hermes Agent is installed from Nous Research commit `7e84d2b5a43d47b1da33cfa662d0f87991774b1c`.
- Hermes requests MLX's reserved `default_model` at `http://127.0.0.1:8080/v1`; `scripts/start-bonsai.sh` binds that name to the pinned local `prism-ml/Ternary-Bonsai-27B-mlx-2bit` snapshot and selects MLX's CPU device before the server imports.
- The official Exa remote MCP is configured with search, advanced search, and fetch tools.
- `data/events.json` contains all 109 source records from the MBIQ Research Hub, with the original date text and confidence labels. Three exact duplicate records are preserved and marked with `duplicate_of`.
- `AGENTS.md` gives Hermes the MBIQ role, research workflow, evidence gates, and writing rules.
- The eval suite measures whether the system completes an editor-ready research job.

## Experiment status

The deep-research brief was experiment 001. It is closed without a model
capability verdict because the runtime failed before January or February
produced an accepted plan. See the [experiment post-mortem](docs/postmortems/001-research-brief-experiment.md).

Experiment 002 is the selected [MBIQ Calendar Desk](docs/rfcs/002-calendar-desk-architecture.md),
adapted from Google's current TypeScript customer-service sample. It replaces
open-ended discovery with one bounded calendar case, structured tools, deterministic
decisions, and an editor handoff.

The model-free Calendar Desk core is implemented and passes ten deterministic
cases. Its [tool contract](docs/calendar-desk.md) caps each result at 2,000
characters and keeps canonical decisions outside the model.

## Run it

> [!WARNING]
> A 44,960-token Hermes turn caused a
> macOS GPU-driver kernel panic on the 24 GiB evaluation Mac. Read the
> [incident report](docs/incidents/2026-07-14-mlx-gpu-kernel-panic.md) and
> [simple safety rules](docs/rfcs/001-local-model-memory-safety.md). Use the
> 32K settings in this repository. The 40 percent compaction logic passed,
> but the 27B canary caused about 6.45 GiB of swap growth. Do not resume the
> monthly evaluation on the failed GPU configuration. The CPU path still needs
> a bounded canary after reboot.

The launcher refuses to start above 1 GiB of existing swap. Reboot the Mac
before the next canary, confirm swap is near zero, and then use:

```bash
./scripts/start-bonsai.sh
```

The launcher uses the exact 27B weights on MLX's CPU device. This avoids model
substitution and keeps inference off the Metal execution path involved in the
panic. A tiny Qwen 3.5 gated-delta forward pass succeeded on CPU, but that only
proves runtime compatibility. It does not replace the full 27B canary.

In another terminal, from this repository:

```bash
scripts/hermes-32k.sh
```

The pinned Hermes revision normally rejects contexts below 64K. This wrapper
uses the narrow compatibility patch in `patches/hermes-32k-minimum.patch` to
lower that startup floor to 32,000 for this evaluation only. It also lets the
configured 40 percent threshold trigger compaction at 12,288 input tokens.

Then give Hermes one bounded Calendar Desk case using
`prompts/calendar-desk.md`. For example:

```text
Read prompts/calendar-desk.md. Answer this case: What is the displayed date and date confidence for event ID february-lunar-new-year? Use the local Calendar Desk command, return the compact case packet, and stop at human editorial review.
```

Test the business rules without loading a model:

```bash
npm run calendar:test
```

After a clean reboot, the exact-model gate is one command:

```bash
scripts/run-calendar-canary.sh
```

It refuses stale swap or low free memory, monitors the run, stops both
processes on every exit path, and verifies the traced Hermes tool call and
final case packet.

The first server start downloads the current 8.49 GB MLX package. The evaluation Mac has enough local storage, but long-context memory safety is not yet proven. Its T7 is mounted as NTFS, which macOS treats as read-only, so `scripts/start-bonsai.sh` overrides the machine's T7 Hugging Face cache setting and uses `~/.cache/huggingface-local`.

## Refresh the event calendar

```bash
npm run events:import
npm run validate
```

The importer finds the deployed Next.js calendar chunk, extracts the calendar array in an isolated JavaScript context, preserves all research notes and source labels, and fails unless exactly 109 events are present. A later site change should fail visibly instead of silently producing partial data.

## Architecture decisions

- [Reference architecture map](docs/reference-architectures.md) explains every relevant pattern in Google's current TypeScript sample and its Hermes equivalent.
- [Model capability assessment](docs/model-capabilities.md) separates Qwen3.6-27B capability claims from the compressed Bonsai model and from the still-unproven MBIQ job.
- [Research brief contract](prompts/research-brief.md) defines the artifact and minimum source bar.
- [Job-level rubric](evals/rubric.md) defines what “meaningful economic job” means here.
- [Verification protocol](docs/verification.md) requires traced January and February planning runs through Hermes, local Bonsai, and Exa.
- [MLX GPU kernel-panic incident](docs/incidents/2026-07-14-mlx-gpu-kernel-panic.md) records the failed long-context run and evidence.
- [Simple local model rules](docs/rfcs/001-local-model-memory-safety.md) use a smaller working range, CPU-only inference, and one observed canary before monthly evaluation resumes.
- [CPU runtime preflight](evals/runs/cpu-runtime-preflight.trace.md) records the non-weight-bearing compatibility check and the remaining reboot gate.
- [Experiment 001 post-mortem](docs/postmortems/001-research-brief-experiment.md) closes the failed economic-job test without overstating model capability.
- [Calendar Desk architecture](docs/rfcs/002-calendar-desk-architecture.md) scores the alternatives and selects the next bounded use case.
- [Calendar Desk tool contract](docs/calendar-desk.md) defines the implemented local operations and deterministic routing boundary.

## Writing approach

The project uses a focused subset of the 814 rules in [shreyashankar/mine-writing-rules](https://github.com/shreyashankar/mine-writing-rules): lead with the main point, use concrete language and active voice, cut filler, calibrate certainty, integrate citations, and keep claims no broader than the evidence. MBIQ adds its own rule: the Queens community is the protagonist.

## Safety boundary

The agent may research and draft locally. It may not publish, contact people, or treat unresolved history as settled fact. Every brief ends at human editorial review.
