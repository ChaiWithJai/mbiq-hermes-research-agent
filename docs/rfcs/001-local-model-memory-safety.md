# RFC 001: Munger-style rules for local model runs

- **Status:** Accepted for the January and February evaluation
- **Date:** 2026-07-14
- **Owner:** Repository maintainer
- **Related incident:** [INC-2026-07-14-MLX-001](../incidents/2026-07-14-mlx-gpu-kernel-panic.md)

## The decision

These are short operating rules inspired by Charlie Munger's focus on avoiding ruin, inversion, and a margin of safety. They are paraphrases, not quotations.

We will keep the local setup simple. We will use a small safe working range and stop when the computer shows strain.

We will not build a proxy, a memory service, a new CI suite, or an approval process.

## The rules

### 1. Avoid ruin

No research run is worth crashing the computer.

- Hermes gets a 32,768 token context for this evaluation.
- MLX may generate no more than 2,048 tokens per turn.
- MLX keeps one prompt cache with a 512 MiB limit.
- Hermes sends one model request at a time.

### 2. Invert the failure

The crash followed three broad searches that added about 147,000 characters to one turn. We will do the opposite.

- Search for one topic at a time.
- Ask for no more than five results.
- Fetch only pages that may be used.
- Write compact source notes before starting the next search.

### 3. Keep a margin of safety

The model supports a much larger context than this Mac has proved it can run. We will use the smaller number.

- The working context is 32,768 tokens, not the model's 262,144 token limit.
- Hermes reserves 2,048 tokens for output and starts compression around 26,112 input tokens.
- We will not raise the working limit during the January or February evaluation.
- If the evidence does not fit, Hermes will split collection from synthesis.

### 4. Change one thing at a time

Before January resumes, we will run one compaction canary that grows past Hermes's 26,112 token trigger. We will confirm that Hermes compacts before it sends another large request to MLX. We will watch Activity Monitor during the run.

If the canary finishes and the computer stays responsive, January may resume with the same settings. We will not change the model, context, cache, and search pattern at the same time.

### 5. Stop when the facts change

Stop the run if any of these things happen:

- Activity Monitor shows red memory pressure.
- Swap grows quickly throughout one request.
- The desktop starts to freeze or lag.
- MLX reports a Metal or memory error.
- Hermes fails to compact after the request estimate passes 26,112 tokens.

Do not retry the same failed request. Shorten the context first.

### 6. Do not fool yourself

A short model reply proves that the model can answer a short prompt. It does not prove that a long agent session is safe.

The January and February traces will record the largest prompt, the number of Exa results, the server settings, and whether the computer showed strain. That is enough evidence for this evaluation.

## What changed after the incident

| Setting | Before | Now |
| --- | --- | --- |
| Hermes context | 262,144 tokens | 32,768 tokens |
| Generated tokens | 8,192 | 2,048 |
| Prompt caches | 2 | 1 |
| Prompt cache limit | 4 GiB | 512 MiB |
| Search pattern | Three broad searches in parallel | One focused search at a time |
| Canary | Short reply only | One observed compaction across the 26,112 token trigger |

## Hermes compaction we rely on

Hermes already has the needed controls. We will use them instead of adding another service.

- The built-in `ContextCompressor` is on by default.
- Hermes estimates the full next request immediately before each model call. This includes tool results that arrived during the current turn.
- At the current settings, Hermes starts compression at about 26,112 input tokens.
- Hermes first replaces older tool results with short notes.
- Hermes then summarizes the middle of the conversation and keeps the system prompt, the first exchange, and four recent messages.
- Hermes caps each message at 6,000 characters when it builds the summary prompt. It does not send a full large Exa result into the summary call.
- Compression stays on the pinned local model instead of probing automatic auxiliary providers. The MLX chat template disables thinking so summaries arrive as usable content, and a compression request that omits an output limit defaults to 512 generated tokens.
- The manual `/compress <focus>` command can compact around one topic when automatic compression needs help.
- Hermes can use another context engine through `context.engine`, but the built-in compressor is enough for this test.

These behaviors come from the pinned Hermes source in `agent/conversation_loop.py`, `agent/context_compressor.py`, and `agent/context_engine.py`.

## When work may resume

January may resume after the compaction canary passes. February may use the same settings after January completes without computer instability.

The canary passed on 2026-07-14. Its sanitized evidence is in [the compaction canary trace](../../evals/runs/compaction-canary.trace.md).

If another kernel panic occurs, local 27B work stops. We will then use a smaller model or a different runtime instead of adding more process around the same setup.
