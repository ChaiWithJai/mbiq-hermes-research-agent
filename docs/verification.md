# End-to-end verification protocol

The goal is not complete when the model answers one prompt. It is complete only after two observable Hermes jobs produce useful editorial artifacts.

## Runs

Before the monthly runs, confirm that `hermes config show` reports:

- a 32,768 token context;
- a 2,048 token output limit;
- compression enabled at a 40 percent configured threshold;
- one protected head message and two protected recent messages;
- the main local model selected for compression;
- MLX thinking disabled so compression returns content rather than a reasoning-only response;
- persistent MLX prompt caching disabled; and
- sequential Exa MCP calls.

Run the compaction canary in [RFC 001](rfcs/001-local-model-memory-safety.md). The canary passes only if the raw Hermes log shows pre-API compression after the request estimate crosses the 12,288-token trigger, the result falls below that trigger, and swap remains stable.

Run from the repository root with the local Bonsai server active:

```bash
set -o pipefail
scripts/hermes-32k.sh chat -v --yolo -t exa,file,terminal --max-turns 60 -q "$(cat evals/prompts/january.txt)" 2>&1 | tee evals/runs/january.raw.log
scripts/hermes-32k.sh chat -v --yolo -t exa,file,terminal --max-turns 90 -q "$(cat evals/prompts/february.txt)" 2>&1 | tee evals/runs/february.raw.log
```

`scripts/start-bonsai.sh` hashes the complete weight file before launch and refuses to start unless it matches the pinned Hugging Face LFS SHA-256.

The raw logs stay local because fetched page text can be large and may carry material that should not be republished. For each run, record a sanitized trace at `evals/runs/<month>.trace.md` with:

- Hermes version, model ID, provider, and endpoint;
- pinned Hugging Face revision and resolved local MLX snapshot path (Hermes sends MLX's reserved `default_model` request name);
- exact prompt path;
- ordered Exa tool calls, queries, and fetched URLs;
- event IDs advanced, held, or rejected;
- output path;
- errors and recovery steps;
- largest request estimate and every Hermes compression event;
- score against `evals/cases.json` and `evals/rubric.md`;
- manual claim and citation findings.

`--yolo` is limited by the job prompt and `AGENTS.md`: the run may research and write inside this repository, but it may not publish or contact anyone. It prevents a non-interactive run from pausing on an expected file write. `display.tool_progress: verbose` records full tool arguments, results, and reasoning in the raw local log.

The explicit `exa,file,terminal` toolset keeps the trajectory focused and reduces irrelevant tool-schema overhead. It still gives the model everything required to inspect local event data, search and fetch evidence, and save the plan.

## Pass conditions

Both runs must:

- execute through Hermes against the local Ternary Bonsai model;
- use Exa search and fetch, not snippets alone;
- meet the full research-brief source bar for the highest-ranked advance, or return a documented gap report;
- preserve event date confidence;
- avoid duplicate records;
- refuse a forced Queens angle when evidence is weak;
- save a usable planning artifact;
- end at human editorial review;
- score 2 on every applicable rubric case.

After both plans and sanitized traces exist, run the deterministic artifact audit:

```bash
npm run verify:plans
```

This checks that every source event was considered with its exact ID, displayed date, and confidence label; February advances no more than four assignments; each plan has source URLs and a human-review gate; and each trace identifies the Hermes/model setup, Exa activity, rubric result, and manual citation audit.
