# Post-mortem 001: MBIQ deep-research brief experiment

## Incident metadata

| Field | Value |
| --- | --- |
| Incident ID | `EXP-2026-07-14-MBIQ-RESEARCH-001` |
| Date | 2026-07-14 |
| Severity | SEV-2 workstation outage; experiment failed |
| Class | Operational outage plus evaluation-design failure |
| Status | Closed as the first use case; no capability verdict |
| Customer impact | None |

## Executive summary

The first use case asked Hermes, Ternary Bonsai 27B, local files, and Exa to
turn 109 MBIQ calendar records into source-backed January and February
editorial plans. The job did not complete. A January run accumulated three
large Exa responses and sent a 42,468-token prefill through MLX. macOS then
kernel-panicked in GPU memory management. A later, smaller 8,570-token
compaction request completed logically but added about 6.45 GiB of swap.

The experiment proved several components: the event importer preserved 109
records, Hermes could use the local endpoint, and the forked compressor fired
at 12,288 tokens. It did not prove that Bonsai can produce an MBIQ research
brief. January and February plans were never accepted, so the model-capability
result is **inconclusive** and the economic-job result is **failed**.

The use case is now closed on this 27B/24 GiB configuration. The next
experiment will use the same model and harness on a bounded calendar-operations
job derived from Google's TypeScript customer-service architecture.

## Customer and business impact

- No customer request, production service, or customer data was involved.
- The evaluation Mac restarted and unsaved local work was exposed to loss.
- The January editorial plan was not produced; February was not attempted.
- Engineering time shifted from evaluating editorial value to recovering the
  workstation and constraining the runtime.
- The public event dataset, architecture analysis, and failure evidence remain
  useful inputs to the next experiment.

## Detection and timeline

Detection was reactive. The first hard signal was the macOS restart. The later
canary was stopped when swap growth violated the operating rule.

| Time | Event | Evidence |
| --- | --- | --- |
| 16:30 | Event importer validates 109 records and marks three duplicates. | `scripts/validate.mjs`; commit `fd83223` |
| 20:29 | January Hermes job starts. | local ignored `evals/runs/january.raw.log` |
| 20:38 | Three advanced Exa searches run in parallel and return about 147,000 characters. | [incident timeline](../incidents/2026-07-14-mlx-gpu-kernel-panic.md#detection-and-timeline) |
| 20:39 | Hermes sends a roughly 44,960-token turn; MLX reports 42,468 prefill tokens. | same incident timeline |
| 20:50 | macOS panics in `IOGPUFamily` while the MLX Python process is active. | incident report; local panic artifact |
| 21:33 | A 32K calibration compacts 38,762 estimated tokens to 17,952. | [compaction trace](../../evals/runs/compaction-canary.trace.md) |
| 22:00 | The 40 percent canary compacts 15,902 estimated tokens to 7,374, but swap grows about 6.45 GiB. | compaction trace |
| 22:10 | Exact-model CPU compatibility passes only a tiny architecture check; full weights remain unloaded because swap is above the launch gate. | [CPU preflight](../../evals/runs/cpu-runtime-preflight.trace.md) |

## Thread of execution

```text
evals/prompts/january.txt
  -> scripts/hermes-32k.sh
  -> Hermes single-agent loop
  -> data/events.json
  -> Exa advanced search x3
  -> full web results appended to conversation
  -> OpenAI-compatible request at localhost:8080
  -> scripts/start-bonsai.sh
  -> Ternary Bonsai 27B / MLX / Metal
  -> IOGPUFamily kernel panic
  -> no January artifact
  -> no February run
```

Repository anchors:

- `evals/prompts/january.txt` defined the monthly job.
- `data/events.json` supplied 109 local records.
- `config/hermes.example.yaml` now records the corrected 32K/40 percent
  settings; those settings did not exist at the first failure.
- `scripts/start-bonsai.sh` pins the exact checkpoint and now refuses startup
  above 1 GiB of existing swap.
- `scripts/verify-plans.mjs` correctly fails while the two expected plans are
  absent.

## Root-cause analysis

### Occurrence 1: the job had no deterministic evidence budget

- **Problem surface:** One editorial job could issue several broad searches
  and ingest arbitrarily large result bodies before synthesis.
- **Evidence:** Three results added about 147,000 characters; the next request
  became a 42,468-token prefill.
- **Code-smell label:** Unbounded fan-out and missing backpressure.
- **Code Complete challenge class:** Performance and resource management.
- **Counter-signal:** Exa returned valid material and Hermes followed its
  prompt. Correct tools can still create an unsafe aggregate workload.

### Occurrence 2: acceptance started above the proven runtime envelope

- **Problem surface:** Short model replies were treated as enough evidence to
  begin a long, tool-using 27B session on a 24 GiB unified-memory Mac.
- **Evidence:** The first full job reached 42,468 prefill tokens and panicked;
  the later 8,570-token summary caused 6.45 GiB of swap growth.
- **Code-smell label:** Happy-path validation and optimistic capacity assumption.
- **Code Complete challenge class:** Defensive programming and integration safety.
- **Counter-signal:** The checkpoint hash and basic inference were valid. They
  proved integrity, not a safe workload envelope.

### Occurrence 3: the experiment coupled too many uncertain capabilities

- **Problem surface:** The first acceptance job combined long context, web
  discovery, source selection, historical judgment, citation discipline,
  brand voice, file writing, and month-wide planning.
- **Evidence:** The rubric required useful plans and source audits, while the
  runtime failed before either plan existed.
- **Code-smell label:** Big-bang integration test.
- **Code Complete challenge class:** Construction planning and incremental integration.
- **Counter-signal:** Each requirement belongs in the eventual product. The
  error was testing all of them before establishing a safe, bounded tool loop.

## Stochastic lens

Web-result length, tool choice, recovery turns, and local-history ambiguity vary
between runs. A prompt asking the model to be concise changes the average but
does not cap the tail. The ternary checkpoint also scores lower than its base
model on agentic tool use and instruction following, so long trajectories add
more opportunities for tool drift. A passing replay would not establish a
stable envelope unless payload size and call count were enforced outside the
model.

## Inversion lens

To guarantee another failure, we would:

- choose an open-ended research job as the first end-to-end test;
- expose broad search before proving a local typed-tool loop;
- let tool output enter the transcript without byte and result caps;
- advertise the model's theoretical context instead of the machine's observed
  limit;
- combine model capability evaluation with runtime stress testing; and
- accept a partial or crashed artifact as evidence of economic value.

The next experiment prevents that path by using one local record per turn,
compact typed tool results, at most one supplied-URL fetch, and deterministic
fixtures with exact expected decisions.

## Mitigations and corrective actions

### Completed containment

| Change | Why | Verification |
| --- | --- | --- |
| Stopped all 27B GPU processes | Prevent recurrence | Process audit found no MLX or Hermes workload |
| Preserved the failed trace and rejected both plans | Avoid a false pass | Plan verifier still reports missing artifacts |
| Added a 32K window and 40 percent compaction | Bound transcript growth | 166 upstream tests pass; canary triggered at 12,288 |
| Disabled persistent prompt caching and parallel search | Reduce retained memory and evidence fan-out | Config and launcher inspection |
| Added CPU-only startup and a swap gate | Remove the failed Metal path from the next experiment | CPU preflight and refusal at 4,812.81 MiB swap |

### Corrective actions

| ID | Action | Owner | Status | Verification path |
| --- | --- | --- | --- | --- |
| P1 | Close deep-research briefs as experiment 001 without a capability verdict. | Maintainer | Complete | This post-mortem and README status |
| P2 | Select one bounded architecture using an explicit scorecard. | Maintainer | Complete | RFC 002 |
| P3 | Implement compact local tools with validation and payload caps. | Maintainer | Complete | `scripts/calendar-desk.mjs`; all observed results remain below 2,000 characters |
| P4 | Create ten fixture cases with exact tool and routing expectations. | Evaluation owner | Complete | Deterministic evaluator passes 10/10 |
| P5 | Reboot, prove a short CPU-only 27B tool loop, then run fixtures one at a time. | Human operator | Planned | Swap, RSS, tokens, calls, latency, and outputs recorded |
| P6 | Reconsider deep research only after bounded jobs pass reliably. | Product owner | Deferred | Separate approved experiment and resource budget |

## Evidence provenance

| Evidence | Provenance | Confidence |
| --- | --- | --- |
| Kernel panic signature and process | Local macOS panic report summarized in incident 001 | Verified |
| 42,468 prefill and Exa payload sizes | Local verbose logs summarized with stable timestamps | High |
| 40 percent compaction behavior | Public canary trace and Hermes patch | Verified |
| 6.45 GiB swap growth | Before/after system readings in canary trace | Verified |
| Model job capability | No accepted January or February output | Not established |

## Closure statement

Experiment 001 is closed because it did not complete the economic job and
cannot safely be rerun on the same GPU path. Closure is not a claim that Bonsai
27B lacks research ability. It means this architecture was a poor first test
for this model, harness, and machine.
