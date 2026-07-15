# RFC 003: Local bug fixer

## Status

Selected for a separate experiment. It is not implemented in this archived
repository.

## Decision

Use Google's Software Bug Assistant as a reference, but keep only a small
local debugging loop.

The Google sample shows an ADK agent with function tools, search, a ticket
database, Stack Overflow, and read-only GitHub tools. Copying that full stack
would repeat the scope problem from this project. Our first version will use
local files and local test commands only.

## Why this use case

| Candidate | Exact result | Local action | First-test scope | Decision |
| --- | --- | --- | --- | --- |
| Local bug fixer | Failing test becomes a passing test | Reads files, patches code, runs tests | Small | Select |
| SDLC task planner | A plan is produced | Writes text only | Small | Reject because the result is subjective |
| Invoice processing | Fields and decisions match a fixture | Reads PDFs and uses many tools | Large | Reject for the first test |
| Deep research | A brief passes editorial review | Searches and writes | Large | Reject because it repeats the failed shape |

Coding is the model's strongest relevant documented category. A failing test
also gives us a clearer result than an editorial review.

## Version one job

The input is one repository, one known failing test, and one reproduction
command.

The agent may:

1. Run the named test once to reproduce the failure.
2. Read files named by the failure or found by a narrow text search.
3. State one testable cause.
4. Make one small patch in an allowed file.
5. Rerun the named test.
6. Run one nearby regression check.
7. Return the diff and test evidence for human review.

The agent may not use the network, install packages, edit issues, commit,
push, or read the whole repository.

## Hard limits

The harness will enforce these limits outside the model:

- one repository and one bug;
- no more than twelve tool calls;
- no more than 8,000 input tokens in one turn;
- no more than four source files read;
- one patch attempt;
- one allowed write path; and
- human approval before any commit.

If a limit is reached, the run stops and reports what remains unknown.

## Acceptance test

Use a small fixture repository with one seeded bug and one failing test. The
experiment passes only when all of these conditions are true:

- the first test run reproduces the expected failure;
- the patch changes only the allowed file;
- the target test passes after the patch;
- the nearby regression check passes;
- the trace contains every tool call and result size; and
- no network call, package change, commit, or unrelated write occurs.

A deterministic harness will verify these facts. A good-looking answer is not
a pass.

## Model capability check

The fixture should first run with a known capable hosted model to validate the
harness. The same fixture can then run through Hermes and the local model. This
separates harness errors from local model errors.

## Governance notes

[PM COMMENT] This design responds to post-mortem 002. It removes network
search, long context, broad file access, and subjective acceptance from the
first complete test.

[PRE-MORTEM] If this experiment fails, likely causes are a loose file boundary,
an ambiguous seeded bug, hidden package setup, or a patch that passes only the
target test. The harness must reject those cases before any model comparison.

## Reference

- [Google ADK Software Bug Assistant](https://github.com/google/adk-samples/tree/main/python/agents/software-bug-assistant)
- Upstream version inspected at commit `40adfa3ad3ba522b8fcda73d5c812f619e1d2ed7`
