# RFC 002: Select the bounded MBIQ Calendar Desk

- **Status:** Proposed for implementation
- **Date:** 2026-07-14
- **Owner:** Repository maintainer
- **Related incident:** `EXP-2026-07-14-MBIQ-RESEARCH-001`
- **Reference:** Google ADK Samples `main` at `40adfa3ad3ba522b8fcda73d5c812f619e1d2ed7`

## Problem statement

The first economic-job test was an open-ended deep-research workflow. It
failed at the runtime layer before model quality could be measured. We need a
second job that still matters to MBIQ, still requires a model in a harness with
tools, but has short inputs, compact outputs, deterministic ground truth, and a
small number of model calls.

[PM COMMENT] The next test should answer one commercial question: can this
local agent remove repetitive calendar-desk work without creating cleanup work
for an editor?

[PRE-MORTEM] If we choose another writing or deep-search workflow, result size
and subjective quality will hide whether the model can reliably use tools.

## Goals and non-goals

Goals:

- complete one real calendar-operations task per session;
- demonstrate reliable typed-tool use with the exact Bonsai 27B checkpoint;
- preserve dates, confidence labels, source URLs, and duplicate status;
- produce an auditable accept, hold, reject, or answer decision; and
- keep a human editor responsible for changes and publication.

Non-goals:

- deep historical research;
- article or research-brief writing;
- broad Exa discovery;
- autonomous publication, outreach, or calendar mutation; and
- proving the model's theoretical 262K context.

[PM COMMENT] A smaller job is not a smaller standard. The output has exact
fields and an objectively wrong answer can be scored as wrong.

## Candidate scorecard

Scores are out of 100. Higher is better. The weights reflect the observed
constraint: the 27B runtime must stay short and bounded before richer work is
credible.

| Candidate | Bounded context (25) | Deterministic tools (20) | Model fit (20) | Hardware margin (20) | Economic proof (15) | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **TypeScript customer service -> MBIQ Calendar Desk** | 24 | 20 | 18 | 18 | 15 | **95** |
| Invoice processing -> event-submission extraction | 22 | 18 | 14 | 17 | 14 | 85 |
| Sequential workflow -> story packaging pipeline | 14 | 13 | 16 | 10 | 12 | 65 |
| Deep search -> research briefs | 4 | 7 | 14 | 2 | 11 | 38 |

Why the Calendar Desk wins:

- Google's current TypeScript tree contains one implemented agent,
  `customer_service`, described as a conversational single agent with tools.
- Its `LlmAgent` registers typed tools and before-agent, before-tool,
  after-tool, and rate-limit callbacks.
- Its tools use Zod schemas and its callbacks validate identity and approval
  boundaries before side effects.
- MBIQ already has the bounded local asset this pattern needs: 109 event
  records with IDs, dates, confidence labels, and duplicate markers.

The base and ternary benchmark evidence also favors this job. Bonsai's reported
agentic/tool score is 74.0 and instruction-following score is 71.8, which is
plausible but not strong enough to trust a long trajectory. Its lower vision
score, 65.2, argues against making document or image extraction the next gate.
Short tool selection over structured records tests the strongest relevant
capability with fewer opportunities for drift.

## Proposed decision

Build **MBIQ Calendar Desk**, a single Hermes agent that handles one compact
request at a time:

1. Answer a question about a known calendar event.
2. Check whether a proposed event duplicates an existing record.
3. Validate a proposed event's required fields and Queens relevance.
4. Route the proposal to `accept`, `hold`, or `reject` with exact reasons.
5. Draft a short response and an editor handoff; never mutate the live calendar.

The first version gets five typed capabilities:

| Tool | Input | Bounded result |
| --- | --- | --- |
| `find_events` | month, neighborhood, optional query | At most five compact records |
| `get_event` | exact event ID | One compact record or not-found |
| `check_duplicate` | title, displayed date, optional venue | Exact and probable matches, at most three |
| `validate_submission` | structured event proposal | Field errors and confidence decision |
| `fetch_supplied_source` | one user-supplied URL | Exa fetch distilled to title, date evidence, location evidence, and URL |

The harness may call at most four tools and one Exa fetch in a job. Search is
not exposed in experiment 002. A supplied URL makes the web boundary finite
while still proving that Hermes can use an external tool.

[PM COMMENT] The economic unit is one calendar-desk case resolved. We can
measure editor minutes saved, correction rate, and escalation quality without
arguing about prose taste.

[PRE-MORTEM] The model may invent an event ID or turn “hold” into “accept.”
Tool results therefore carry canonical IDs and the final artifact must echo the
validator's status verbatim.

## Reference-architecture mapping

| Google TypeScript customer service | MBIQ Calendar Desk |
| --- | --- |
| One conversational `LlmAgent` | One Hermes project and one active case |
| Customer profile in session state | Editor role and current submission in session state |
| Zod `FunctionTool` schemas | JSON-schema/MCP wrappers around calendar functions |
| Product and cart lookup | Event and duplicate lookup |
| Appointment availability | Calendar-date validation |
| Manager discount approval | Human editorial approval for accept/reject |
| Before-tool customer-ID validation | Before-tool event-ID, payload-size, and Queens-scope validation |
| After-tool side-effect handling | After-tool canonical status and audit record |
| Model-request rate limit | Four-tool, one-fetch, and token budgets |

This is architectural reuse, not a second orchestration dependency. Hermes
remains the runner; the Google sample supplies the bounded service pattern.

## SDLC guardrails

- **Schema CI:** reject tools without required schemas, result limits, and
  explicit error variants.
- **Payload CI:** fixture tests fail if any local tool result exceeds 2,000
  characters or returns more than its documented record cap.
- **Trajectory CI:** fixture traces fail above four tool calls, one web fetch,
  or 4,096 estimated input tokens.
- **Decision CI:** the final status must equal the deterministic validator's
  status and include every canonical event ID it cites.
- **Safety CI:** fixtures cover tentative dates, duplicates, missing sources,
  non-Queens proposals, and attempted publication.
- **Release check:** run ten cases one at a time on the exact checkpoint after
  a clean reboot; record tokens, calls, latency, RSS, and swap.
- **Ownership:** the maintainer owns runtime safety; the MBIQ editor owns
  acceptance semantics and reviews every proposed change.
- **Evidence:** no “slam dunk” claim until all ten cases pass twice with no
  unsupported IDs, wrong status, or hardware stop event.

[PRE-MORTEM] If these controls remain prompt prose, delivery pressure will
erase them. Each budget must be asserted by the runner or evaluator.

## Incident mapping

| Experiment 001 failure | Experiment 002 control |
| --- | --- |
| Three broad searches | No search tool; one supplied-URL fetch maximum |
| 147,000 characters of tool output | 2,000-character result ceiling |
| 42,468-token prefill | 4,096-token trajectory ceiling |
| Long subjective synthesis | Four-state deterministic decision |
| Month-wide job | One case per fresh session |
| No model-quality verdict after crash | Ten exact fixture outcomes before live work |

[PM COMMENT] Closure means the new test makes the old failure structurally
unreachable, not merely less likely.

## Rollout plan

### Phase 1: deterministic core

- Implement read-only local event lookup, duplicate checking, and validation.
- Add ten fixtures and a model-free evaluator.
- Verify all tool caps without loading Bonsai.

### Phase 2: exact-model harness canary

- Reboot to clear stale swap.
- Start the exact 27B checkpoint on the CPU path.
- Run one known-event lookup with no Exa call.
- Stop if any runtime guard changes the machine's safe state.

### Phase 3: economic-job evaluation

- Run ten fresh Hermes sessions, one fixture per session.
- Add the supplied-URL fetch only after five local-only cases pass.
- Have an editor score usefulness and correction time.

## Success metrics

- 10/10 deterministic case outcomes on two runs;
- zero invented event IDs or date-confidence upgrades;
- zero unauthorized writes, publication, or outreach;
- no tool result over 2,000 characters;
- no trajectory over four tools, one fetch, or 4,096 input tokens;
- no runtime stop event, panic, or abnormal swap growth; and
- median editor correction time below two minutes per case.

## Risks and tradeoffs

| Risk | Mitigation |
| --- | --- |
| CPU inference is too slow for useful service | Measure wall time in phase 2; fail the deployment claim even if answers are correct |
| Bounded fixtures overstate real reliability | Run two passes and add adversarial paraphrases after the deterministic gate |
| Local-only lookup seems less agentic | Require multi-step duplicate and validation cases plus one bounded Exa fetch |
| Calendar work is less glamorous than storytelling | Treat it as the foundation; research returns only after reliable operations are proven |
| The Google sample uses mock backends | Keep experiment 002 read-only and judge decisions, not production integration |

## Decision requested

Approve MBIQ Calendar Desk as experiment 002 and retire deep-research briefs as
the acceptance target for this hardware configuration. Implementation begins
with model-free typed tools and fixtures; no 27B weights load until the machine
has rebooted and the swap gate passes.
