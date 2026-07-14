# End-to-end verification protocol

The goal is not complete when the model answers one prompt. It is complete only after two observable Hermes jobs produce useful editorial artifacts.

## Runs

Run from the repository root with the local Bonsai server active:

```bash
hermes chat -v --max-turns 60 -q "$(cat evals/prompts/january.txt)" 2>&1 | tee evals/runs/january.raw.log
hermes chat -v --max-turns 90 -q "$(cat evals/prompts/february.txt)" 2>&1 | tee evals/runs/february.raw.log
```

The raw logs stay local because fetched page text can be large and may carry material that should not be republished. For each run, record a sanitized trace at `evals/runs/<month>.trace.md` with:

- Hermes version, model ID, provider, and endpoint;
- exact prompt path;
- ordered Exa tool calls, queries, and fetched URLs;
- event IDs advanced, held, or rejected;
- output path;
- errors and recovery steps;
- score against `evals/cases.json` and `evals/rubric.md`;
- manual claim and citation findings.

## Pass conditions

Both runs must:

- execute through Hermes against the local Ternary Bonsai model;
- use Exa search and fetch, not snippets alone;
- preserve event date confidence;
- avoid duplicate records;
- refuse a forced Queens angle when evidence is weak;
- save a usable planning artifact;
- end at human editorial review;
- score 2 on every applicable rubric case.

