# Incident 2026-07-14: MLX GPU kernel panic during Hermes evaluation

## Incident metadata

| Field | Value |
| --- | --- |
| Incident ID | `INC-2026-07-14-MLX-001` |
| Date | 2026-07-14 |
| Severity | SEV-2: developer workstation outage and data-loss risk |
| Class | Operational outage |
| Status | Reopened; 27B canary caused unsafe swap growth at 22:00 on 2026-07-14 |
| Customer impact | None |
| Direct impact | The evaluation Mac kernel-panicked and restarted; the in-flight January run was lost |

## Executive summary

During a local Hermes evaluation of the 2-bit Ternary Bonsai 27B model, three parallel Exa searches added about 147,000 characters of tool output to one agent turn. Hermes then submitted a roughly 44,960-token request to `mlx_lm.server`. We did not attempt the model's theoretical 262,144-token context. Hermes advertised that limit, but the failing request used about 17 percent of it.

MLX reported a 42,468-token prefill for the request. The last progress observed in the live server output was 36,864 of 42,468 tokens at 20:49:21. The kernel panic occurred 76 seconds later, at 20:50:37, before the model returned an answer. The exact final prefill token was not written to disk. macOS panicked in `IOGPUFamily` with `"completeMemory() prepare count underflow" @IOGPUMemory.cpp:550`.

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
| 20:49:21 | MLX reports 36,864 of 42,468 prompt tokens processed. This is the last observed progress line. | live server output captured during the run |
| 20:50:37 | macOS panics in `IOGPUFamily`; panicked task is `pid 74906: python3.13`, 29 threads. | `/Library/Logs/DiagnosticReports/.contents.panic` (local system artifact) |
| 20:52:05 | After reboot, the server is restarted while recovering the interrupted evaluation. | local terminal trace |
| 20:55 | The operator reports the crash; Hermes and MLX are stopped. | local process audit confirms no `hermes chat` or `mlx_lm.server` process remains |
| 21:33 | The corrected 32K canary compacts 38,762 estimated tokens to 17,952 with a real summary and no fallback. | `evals/runs/compaction-canary.trace.md` |
| 22:00 | A forked 40 percent canary compacts successfully, but swap grows from 2.46 GiB to 8.91 GiB. MLX is stopped. | `evals/runs/compaction-canary.trace.md` |

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

- At incident commit `fd83223`, `scripts/start-bonsai.sh:27-33` started the server with an 8,192-token output ceiling and a 4 GiB prompt-cache allowance, but no input-context or Metal-memory ceiling.
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

The trigger chain is **high confidence**: a large MLX model had processed at least 36,864 prefill tokens from a roughly 44,960-token agent turn immediately before the matching panic, and upstream MLX reports reproduce the same signature under long-context server workloads.

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

RFC 001 addresses those paths with a smaller working range, focused searches, one observed canary, and clear stop conditions.

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
| A1 | Set Hermes to a 32,768 token context with 2,048 tokens reserved for output. | Repo maintainer | Before canary | Complete | `config/hermes.example.yaml` contains the smaller limit |
| A2 | Reduce MLX output, cache, prefill size, and concurrency defaults. | Repo maintainer | Before canary | Complete | `scripts/start-bonsai.sh` contains the smaller defaults |
| A3 | Keep Exa searches focused and sequential. | Evaluation author | Before canary | Complete | January and February prompts limit discovery and fetching |
| A4 | Run one observed canary across the forked 12,288-token compaction trigger. | Human operator | Before January | Failed on 27B | Compaction succeeded, but swap grew by about 6.45 GiB; see `evals/runs/compaction-canary.trace.md` |
| A5 | Resume January and February with the same settings. | Evaluation author | After A4 | Open | Both traced jobs finish without computer instability |

## Evidence provenance

| Evidence | Provenance | Public handling |
| --- | --- | --- |
| Panic signature and panicked task | `/Library/Logs/DiagnosticReports/.contents.panic`, generated 2026-07-14 20:50 | Minimal non-personal excerpt recorded here; full system report is not committed |
| Hermes requests and Exa payload sizes | `evals/runs/january.raw.log` | Raw verbose log remains ignored because it can contain fetched page bodies; stable line anchors summarized here |
| Runtime command | Commit `fd83223`, `scripts/start-bonsai.sh:27-33` | Committed source |
| Machine memory | `sysctl -n hw.memsize` = 25,769,803,776 bytes | Aggregate hardware fact only |
| Upstream matching reports | MLX GitHub issues linked above | Public primary-source issue records |

## Closure criteria

This incident is reopened because the 27B model caused unsafe swap growth even when the fork compacted at 40 percent and persistent prompt caching was disabled. Do not resume the 27B evaluation on this Mac. A smaller model or different runtime requires a new canary before monthly work resumes.
