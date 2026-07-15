# Incident 2026-07-14: MLX GPU kernel panic during Hermes evaluation

## Incident metadata

| Field | Value |
| --- | --- |
| Incident ID | `INC-2026-07-14-MLX-001` |
| Date | 2026-07-14 |
| Severity | SEV-2: developer workstation outage and data-loss risk |
| Class | Operational outage |
| Status | Contained; 27B evaluation paused pending safety controls |
| Customer impact | None |
| Direct impact | The evaluation Mac kernel-panicked and restarted; the in-flight January run was lost |

## Executive summary

During a local Hermes evaluation of the 2-bit Ternary Bonsai 27B model, three parallel Exa searches added about 147,000 characters of tool output to one agent turn. Hermes then submitted a roughly 44,960-token request to `mlx_lm.server`. While MLX was processing that long context, macOS panicked in `IOGPUFamily` with `"completeMemory() prepare count underflow" @IOGPUMemory.cpp:550`.

The panic report definitively identifies the panicked task as a 29-thread `python3.13` process. The timestamp, runtime, and signature match the MLX server used by this evaluation. Similar failures are reported upstream for long-context `mlx_lm.server` workloads in [mlx-lm#883](https://github.com/ml-explore/mlx-lm/issues/883) and for the same Apple GPU panic signature in [mlx#3346](https://github.com/ml-explore/mlx/issues/3346).

The Apple GPU driver failure is the immediate cause. The evaluation harness made the failure reachable by allowing unbounded tool-result growth, advertising a 262,144-token context, and starting a large local model without a request-size gate or runtime memory abort threshold. The 27B server and Hermes process were stopped after the incident. They must not be restarted for acceptance work until the controls in [RFC 001](../rfcs/001-local-model-memory-safety.md) are implemented and verified.

## Impact

- The Mac became unavailable until its automatic restart completed.
- The January research plan was not written; only the ignored raw trace survived.
- Unsaved work in any application on the workstation was at risk.
- No public service was running, no customer request was served, and no customer data was involved.
- The public repository and downloaded model weights remained intact.

## Detection and timeline

Times are America/New_York on 2026-07-14.

| Time | Event | Evidence |
| --- | --- | --- |
| 20:29:21 | January Hermes attempt starts with the pinned local model and 13-tool restricted toolset. | `evals/runs/january.raw.log:906` (local, ignored) |
| 20:32:37 | The agent's first month-filter command fails, then the agent recovers. | `evals/runs/january.raw.log:995` |
| 20:38:44 | Hermes launches three parallel advanced Exa searches, each requesting eight results. | `evals/runs/january.raw.log:1173-1175` |
| 20:38:54–20:39:06 | Exa returns 60,023, 33,342, and 54,027 characters. | `evals/runs/january.raw.log:1185,1738,2052` |
| 20:39:07 | Hermes submits the combined turn, estimated at 44,960 tokens. | `evals/runs/january.raw.log:2547-2549` |
| 20:50:37 | macOS panics in `IOGPUFamily`; panicked task is `pid 74906: python3.13`, 29 threads. | `/Library/Logs/DiagnosticReports/.contents.panic` (local system artifact) |
| 20:52:05 | After reboot, the server is restarted while recovering the interrupted evaluation. | local terminal trace |
| 20:55 | The operator reports the crash; Hermes and MLX are stopped. | local process audit confirms no `hermes chat` or `mlx_lm.server` process remains |

Detection was reactive: macOS restarted and surfaced a panic dialog. The harness had no proactive context-size or Metal-memory alarm.

## Thread of execution

```text
evals/prompts/january.txt
  -> hermes chat (custom OpenAI-compatible provider)
  -> Exa MCP advanced search x3 in parallel
  -> full search bodies appended to Hermes conversation
  -> 44,960-token /v1/chat/completions request
  -> scripts/start-bonsai.sh
  -> mlx_lm.server + Ternary Bonsai 27B 2-bit
  -> MLX Metal allocations and growing KV cache
  -> Apple IOGPUFamily completeMemory() panic
  -> full workstation restart
```

Repository anchors:

- `scripts/start-bonsai.sh:27-33` starts the server with an 8,192-token output ceiling and a 4 GiB prompt-cache allowance, but no input-context or Metal-memory ceiling.
- `evals/prompts/january.txt:1` now limits discovery searches to five results and forbids broad parallel searches. This reduces exposure but is not a sufficient runtime control.
- `config/hermes.example.yaml` advertises a 262,144-token context to Hermes.

## Root-cause analysis

### Occurrence 1: unbounded evidence amplification

- **Problem surface:** Three broad searches ran concurrently and injected about 147,000 characters into one conversation turn.
- **Evidence:** Raw trace anchors `1173-1175`, `1185`, `1738`, `2052`, and `2549` above.
- **Code-smell label:** Unbounded resource consumption; fan-out without backpressure.
- **Code Complete challenge class:** Performance and resource management.
- **Counter-signal:** Hermes and Exa behaved as requested and returned valid results. The defect is not tool correctness; it is the absence of a budget around correct-but-large tool output.

### Occurrence 2: unsafe local-runtime envelope

- **Problem surface:** The server accepted a context far larger than had been canary-tested on a 24 GiB unified-memory Mac. The installed `mlx_lm.server` exposes no `--max-kv-size` flag, and the launch script had no input-token gate or Metal-memory monitor.
- **Evidence:** `scripts/start-bonsai.sh:27-33`; local `mlx_lm.server --help`; `sysctl -n hw.memsize` returned `25769803776`; upstream [mlx-lm#615](https://github.com/ml-explore/mlx-lm/issues/615) documents the missing server KV-cache control.
- **Code-smell label:** Missing guard condition; optimistic resource assumption.
- **Code Complete challenge class:** Defensive programming and integration safety.
- **Counter-signal:** Model weights were checksum-pinned and the server had passed short direct prompts. Those checks proved integrity and basic inference only; they did not prove long-context stability.

### Immediate cause and confidence

The immediate cause is **verified**: Apple `IOGPUFamily` panicked at `IOGPUMemory.cpp:550` while the MLX Python process was active.

The trigger chain is **high confidence**: a large MLX model was processing a 44,960-token agent turn immediately before the matching panic, and upstream MLX reports reproduce the same signature under long-context server workloads.

The narrower statement that ordinary pageable RAM was exhausted is **not proven by this panic excerpt**. It reports compressor and swap status as OK. The safer conclusion is that this workload triggered an Apple GPU-memory bookkeeping failure; unified-memory/KV growth is a supported mechanism, not a directly measured final allocation in this incident.

## Stochastic lens

Agent tool selection and web-result size vary from run to run. A prompt-only instruction such as “keep searches focused” can reduce average context but cannot guarantee a safe maximum. The same nominal evaluation may pass with concise results and panic with unusually long pages, extra recovery turns, or parallel tool calls. Safety must therefore be enforced outside the model at deterministic request and memory boundaries.

## Inversion lens

To guarantee recurrence, we would:

- advertise the model's theoretical 262k context as if it were safe on this workstation;
- allow full web pages from several parallel searches into one turn;
- retain a 4 GiB prompt cache while leaving KV growth unbounded;
- treat a short smoke test as evidence for a long agentic session;
- restart immediately after a panic without changing the resource envelope; and
- rely on Activity Monitor or a human noticing pressure after the GPU has already allocated memory.

RFC 001 blocks each of those paths with request rejection, bounded evidence, a staged canary, memory telemetry, and a no-go state after any panic.

## Mitigation and corrective actions

### Completed containment

| Change | Why | Verification |
| --- | --- | --- |
| Stopped all `hermes chat` and `mlx_lm.server` processes | Prevent immediate recurrence | Process audit returned no matching workload |
| Preserved the interrupted raw trace | Retain evidence and failed-attempt history | `evals/runs/january.raw.log` remains local and ignored |
| Limited January and February discovery prompts | Reduce tool-result fan-out during future canaries | Both monthly prompts cap queries at five results and require selective fetching |
| Kept the January plan unaccepted | Avoid converting a crashed partial run into a false pass | `briefs/2027-january-plan.md` does not exist |

### Required actions

| ID | Action | Owner | Due | Status | Verification path |
| --- | --- | --- | --- | --- | --- |
| A1 | Add a hard input-token/request-byte gate in front of MLX. | Repo maintainer | Before any 27B rerun | Open | Oversized fixture receives a deterministic rejection before MLX |
| A2 | Replace direct server launch with a wrapper that sets conservative MLX cache, memory, and wired limits supported by the installed version. | Repo maintainer | Before any 27B rerun | Open | Startup prints effective limits; automated smoke asserts them |
| A3 | Reduce prompt-cache size/bytes and default output limit for evaluation mode. | Repo maintainer | Before canary | Open | Process command and server startup record bounded values |
| A4 | Add live `mx.metal` active/cache/peak telemetry and abort below an OS-reserve threshold. | Repo maintainer | Before canary | Open | Synthetic threshold test terminates the request/server cleanly |
| A5 | Run staged 2k, 4k, 8k, then 12k context canaries; stop on pressure, swap acceleration, or Metal errors. | Human operator | After A1–A4 | Open | Signed canary table with peak memory and exit result |
| A6 | Resume January and February only within the largest canary-proven envelope; split research into bounded jobs if necessary. | Human operator | After A5 | Open | Both Hermes traces show enforced budgets and completed artifacts |
| A7 | Document upstream/version status and reassess after macOS or MLX upgrades. | Repo maintainer | Before dependency upgrade | Open | Version-specific safety note updated with official issue links |

## Evidence provenance

| Evidence | Provenance | Public handling |
| --- | --- | --- |
| Panic signature and panicked task | `/Library/Logs/DiagnosticReports/.contents.panic`, generated 2026-07-14 20:50 | Minimal non-personal excerpt recorded here; full system report is not committed |
| Hermes requests and Exa payload sizes | `evals/runs/january.raw.log` | Raw verbose log remains ignored because it can contain fetched page bodies; stable line anchors summarized here |
| Runtime command | `scripts/start-bonsai.sh:27-33` | Committed source |
| Machine memory | `sysctl -n hw.memsize` = 25,769,803,776 bytes | Aggregate hardware fact only |
| Upstream matching reports | MLX GitHub issues linked above | Public primary-source issue records |

## Closure criteria

This incident remains open until A1–A5 are implemented and a bounded canary completes without a kernel panic, Metal error, unsafe memory peak, or unbounded request. Completion of the January and February editorial plans is not an incident-closure substitute.
