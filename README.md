# MBIQ Hermes research agent

A small, local-first research desk for Meanwhile Back in Queens. Hermes is the agent harness, Ternary Bonsai 27B is the local model, Exa supplies web search and page fetch, and the output is a source-backed research brief for a human editor.

## What is ready

- Hermes Agent is installed from Nous Research commit `7e84d2b5a43d47b1da33cfa662d0f87991774b1c`.
- Hermes requests MLX's reserved `default_model` at `http://127.0.0.1:8080/v1`; `scripts/start-bonsai.sh` binds that name to the pinned local `prism-ml/Ternary-Bonsai-27B-mlx-2bit` snapshot.
- The official Exa remote MCP is configured with search, advanced search, and fetch tools.
- `data/events.json` contains all 109 source records from the MBIQ Research Hub, with the original date text and confidence labels. Three exact duplicate records are preserved and marked with `duplicate_of`.
- `AGENTS.md` gives Hermes the MBIQ role, research workflow, evidence gates, and writing rules.
- The eval suite measures whether the system completes an editor-ready research job.

## Run it

> [!WARNING]
> Local 27B runs are temporarily disabled. A 44,960-token Hermes turn caused a
> macOS GPU-driver kernel panic on the 24 GiB evaluation Mac. Read the
> [incident report](docs/incidents/2026-07-14-mlx-gpu-kernel-panic.md) and
> [memory-safety RFC](docs/rfcs/001-local-model-memory-safety.md). Do not start
> `mlx_lm.server` for this evaluation until the RFC's blocking controls and
> hardware canary have passed.

After those controls are implemented and approved, the intended entry point is:

```bash
./scripts/start-bonsai.sh
```

In another terminal, from this repository:

```bash
hermes
```

Then give Hermes a bounded job:

```text
Choose one Queens-specific event from data/events.json. Build a research brief under the contract in prompts/research-brief.md. Use Exa search and fetch, save the result to briefs/<event-id>.md, and score it against evals/cases.json and evals/rubric.md. Stop at the human editorial review gate.
```

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
- [Local model memory-safety RFC](docs/rfcs/001-local-model-memory-safety.md) blocks further 27B acceptance runs until deterministic guards and a hardware canary pass.

## Writing approach

The project uses a focused subset of the 814 rules in [shreyashankar/mine-writing-rules](https://github.com/shreyashankar/mine-writing-rules): lead with the main point, use concrete language and active voice, cut filler, calibrate certainty, integrate citations, and keep claims no broader than the evidence. MBIQ adds its own rule: the Queens community is the protagonist.

## Safety boundary

The agent may research and draft locally. It may not publish, contact people, or treat unresolved history as settled fact. Every brief ends at human editorial review.
