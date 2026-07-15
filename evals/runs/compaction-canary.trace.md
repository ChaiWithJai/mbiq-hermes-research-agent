# Hermes compaction canary trace

- **Date:** 2026-07-14, America/New_York
- **Result:** Pass
- **Hermes commit:** `7e84d2b5a43d47b1da33cfa662d0f87991774b1c`
- **Model:** `prism-ml/Ternary-Bonsai-27B-mlx-2bit`
- **Model revision:** `badd9a64565446a6eb8b76583dfa2a62917d8347`
- **Weight SHA-256:** `8acd4597893ea7004e2d7336c3cf6e3157b8896592bbcf066db004021e45846b`

## Configuration under test

- Hermes context: 32,768 tokens
- Hermes normal-turn output allowance: 2,048 tokens
- Exact automatic compression trigger: 26,112 estimated input tokens
- Compression target: 20 percent
- Protected head: 3 non-system messages
- Protected tail: 4 messages
- Compression provider: `main`, the pinned local custom endpoint
- MLX default output for requests that omit `max_tokens`: 512 tokens
- MLX chat template: `enable_thinking=false`
- MLX prompt concurrency: 1
- MLX decode concurrency: 1
- MLX prefill step: 512 tokens
- MLX prompt cache: one sequence, 512 MiB ceiling

## Workload

The canary used the real Hermes `ContextCompressor` and the real local model. It built 16 alternating synthetic user and assistant messages. Every message contained a unique `CANARY_TURN_nn` marker and repeated non-sensitive Queens heritage filler. No production conversation, credential, or fetched page entered the canary.

Hermes estimated the original conversation at 38,762 tokens. This exceeded the 26,112-token automatic threshold. Hermes serialized only the bounded middle window for summarization. MLX reported a 12,192-token prefill for that summary call, not a 38,762-token prefill.

## Result

The final run produced:

```text
CANARY_CONFIG {"context_length": 32768, "max_tokens": 2048, "messages_before": 16, "rough_tokens_before": 38762, "tail_token_budget": 5222, "threshold_tokens": 26112}
CANARY_RESULT {"compression_count": 1, "fallback_used": false, "messages_after": 8, "rough_tokens_after": 17952, "summary_present": true}
COMPACTION_CANARY_OK
```

The compressor reduced the conversation from 16 messages and 38,762 estimated tokens to 8 messages and 17,952 estimated tokens. The result was below the trigger, contained a real model-generated summary, and did not use Hermes's deterministic fallback.

## Calibration findings

Two controlled attempts preceded the pass:

1. With automatic auxiliary routing and a 2,048-token server default, Hermes probed unavailable OpenRouter and Nous routes before using the local model. The local summary request did not complete within the bounded observation window, so the operator stopped it.
2. With compression pinned to `main` and the server default reduced to 512 tokens, the model returned all generated text in the API `reasoning` field. Hermes correctly treated the empty `message.content` as a summary failure, used its deterministic fallback, and still reduced the conversation to 19,013 estimated tokens.

The final configuration pins compression to `main`, retains the 512-token server default for omitted output limits, and disables thinking in the MLX chat template. This made the summary available in `message.content` and removed the remote-provider probes.

## Machine observations

- Memory free before the final run: 69 percent
- Memory free immediately after the final result, while the model was still resident: 28 percent
- Memory free after clean shutdown: 71 percent
- Swap before the final run: 2,106.69 MiB used
- Swap after the final run: 2,098.69 MiB used
- Swap growth during the final run: none
- Metal or GPU memory errors: none observed
- Desktop lag or freeze: none observed
- Remaining `mlx_lm.server`, canary, or `caffeinate -dimsu` process after shutdown: none

## Decision

The compaction boundary is accepted for the 32K January evaluation. January must keep the same model, context, cache, thinking, concurrency, and sequential-search settings. February may start only after January completes without instability.
