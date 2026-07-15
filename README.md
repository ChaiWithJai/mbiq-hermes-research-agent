# Archived: MBIQ Hermes research agent

This repository is the record of a closed experiment. It is not a working
research agent and should not be used as a setup guide.

## What we tried

We asked Hermes and a local Ternary Bonsai 27B model to turn 109 MBIQ event
records into source-backed January and February editorial plans. The agent
could also search the web through Exa.

This was too ambitious for a first test. It combined local model setup, long
context, web search, citation checks, historical judgment, editorial voice,
and month-wide planning in one run.

## What happened

The January run sent 42,468 prefill tokens to MLX after three large search
results entered the conversation. The Mac then restarted because of a GPU
driver kernel panic. A later compaction test produced an 8,570-token summary,
but swap grew by about 6.45 GiB.

No January or February plan was accepted. The experiment therefore did not
prove whether the model can do the editorial job.

## What worked

The event importer preserved 109 records and marked three exact duplicates.
Hermes compaction triggered at the configured limit. A later model-free
Calendar Desk passed ten deterministic tests. These were useful component
checks, but they did not prove the complete agent.

## What we learned

Start with one small job that has an exact pass condition. Prove one local
tool call, one model decision, and one verification step before adding search,
long context, or editorial judgment.

The selected next experiment is a local bug fixer based on Google's Software
Bug Assistant sample. It will reproduce one failing test, inspect a small set
of local files, make one patch, and rerun the test. It will not use web search,
a ticket database, remote GitHub tools, or automatic commits.

## Records

- [Project post-mortem](docs/postmortems/002-project-was-too-ambitious.md)
- [GPU kernel panic incident](docs/incidents/2026-07-14-mlx-gpu-kernel-panic.md)
- [First experiment post-mortem](docs/postmortems/001-research-brief-experiment.md)
- [Next local experiment](docs/rfcs/003-local-bug-fixer.md)
- [Model capability notes](docs/model-capabilities.md)
- [Event data](data/events.json)
- [Calendar Desk tests](evals/calendar-desk-cases.json)

The code and traces remain here as evidence. This repository is archived and
will not receive further development.
