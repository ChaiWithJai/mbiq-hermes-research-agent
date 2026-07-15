# Post-mortem 002: The project was too ambitious

## Incident metadata

| Field | Value |
| --- | --- |
| Incident ID | `EXP-2026-07-14-MBIQ-SCOPE-002` |
| Date | 2026-07-14 |
| Impact class | Workstation outage and failed evaluation |
| Status | Closed and archived |
| Customer impact | None |

## Executive summary

We tried to prove too many things in one experiment. The job combined a new
agent harness, a compressed local model, long context, web search, source
checks, local history, editorial judgment, and monthly planning.

The January run reached 42,468 prefill tokens and caused a macOS GPU driver
panic. A later compaction request completed, but it added about 6.45 GiB of
swap. No January or February plan passed review.

The failure does not show that the model cannot do research. It shows that the
project was a poor first test. We could not separate model quality from tool
design, context growth, or machine limits. We are archiving the repository and
moving to one bounded local task with an exact pass condition.

## Customer and business impact

No customer or production data was involved. The evaluation Mac restarted,
unsaved work was at risk, and the planned editorial artifacts were not
produced. Time moved from product evaluation to crash recovery and runtime
safety work.

## Detection and timeline

| Event | Evidence |
| --- | --- |
| The importer validated 109 events and marked three duplicates. | `data/events.json` and `scripts/validate.mjs` |
| Three Exa searches added about 147,000 characters to the January run. | Incident 001 timeline |
| MLX reported 42,468 prefill tokens. | Incident 001 timeline |
| macOS panicked in `IOGPUFamily`. | Incident 001 panic record |
| A later 40 percent compaction test created an 8,570-token summary. | `evals/runs/compaction-canary.trace.md` |
| Swap grew by about 6.45 GiB during that test. | Same compaction trace |
| The model-free Calendar Desk passed ten cases. | `npm run calendar:test` |
| No accepted January or February plan was produced. | `scripts/verify-plans.mjs` |

## Thread of execution

```text
109 local events
  -> one month-wide research request
  -> three broad web searches
  -> full results added to the conversation
  -> 42,468-token MLX prefill
  -> GPU driver panic
  -> no accepted January plan
  -> no February run
```

## Root causes

### We combined too many unknowns

The first complete test covered model setup, tool use, search, citation work,
historical judgment, writing, and long-context operation.

- Code smell: Big-bang integration.
- Code Complete class: Construction planning and incremental integration.
- Counter-signal: Each part was relevant to the eventual product. That did
  not make them safe to test together first.

### We had no hard evidence budget

The model could request broad searches, and complete tool results entered the
conversation. Prompt instructions asked for restraint but did not enforce a
limit.

- Code smell: Unbounded resource use.
- Code Complete class: Performance and resource management.
- Counter-signal: The search results were valid. Valid results can still be
  too large for the machine.

### We confused component checks with product proof

Short prompts, checksum checks, compaction logic, and deterministic Calendar
Desk tests passed. None of them proved that the full Hermes and Bonsai job was
safe or useful.

- Code smell: Happy-path validation.
- Code Complete class: Defensive programming and integration safety.
- Counter-signal: The passing checks were real. Their scope was narrower than
  the claim we wanted to make.

## Stochastic lens

Search result size, model tool choices, and recovery turns change between
runs. A prompt can influence these values, but it cannot cap them. Tool count,
payload size, file access, and token use must be limited outside the model.

## Inversion lens

We could guarantee another failure by starting with a broad research task,
adding network search before proving local tools, using a theoretical context
limit, and treating one component test as proof of the whole system.

The next experiment does the opposite. It starts with one failing test, local
files, one patch, and an exact test result.

## Actions

| Action | Owner | Status | Verification |
| --- | --- | --- | --- |
| Close the research experiment without a model capability verdict. | Maintainer | Complete | Post-mortems 001 and 002 |
| Replace the setup guide with an archive README. | Maintainer | Complete | Repository root README |
| Preserve the incident, traces, data, and tests. | Maintainer | Complete | Public repository history |
| Archive this GitHub repository after the final push. | Maintainer | Complete when GitHub reports read-only archive state | GitHub repository metadata |
| Select a smaller local use case with an exact pass condition. | Maintainer | Complete | RFC 003 |
| Require hard limits on tool calls, context, files, and writes. | Next project owner | Planned | Automated harness assertions |

## Evidence provenance

| Claim | Source | Confidence |
| --- | --- | --- |
| 42,468-token prefill and GPU panic | Local MLX log and macOS panic report summarized in incident 001 | High |
| 6.45 GiB swap growth | Before and after readings in the compaction trace | High |
| 109 events and three duplicates | Checked-in data and validator | Verified |
| Calendar Desk passed ten cases | Deterministic local test suite | Verified |
| Model can complete the editorial job | No accepted plan exists | Not established |

## Closure

This project is closed because the first use case was too broad to provide a
clear or safe result. The repository stays public as a record of the evidence,
the mistake, and the narrower experiment that should follow.
