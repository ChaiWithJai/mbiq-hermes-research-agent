# Hermes 32K compaction canary trace

- **Date:** 2026-07-14, America/New_York
- **Result:** Compaction logic passed; 27B hardware safety failed
- **Hermes commit:** `7e84d2b5a43d47b1da33cfa662d0f87991774b1c` plus `patches/hermes-32k-minimum.patch`
- **Model:** `prism-ml/Ternary-Bonsai-27B-mlx-2bit`
- **Model revision:** `badd9a64565446a6eb8b76583dfa2a62917d8347`
- **Weight SHA-256:** `8acd4597893ea7004e2d7336c3cf6e3157b8896592bbcf066db004021e45846b`

## Configuration under test

- Hermes context: 32,768 tokens
- Hermes normal-turn output allowance: 2,048 tokens
- Automatic compression trigger: 12,288 estimated input tokens, 40 percent of the 30,720-token input budget
- Compression target: 20 percent
- Protected head: 1 non-system message
- Protected tail: 2 messages
- Compression provider: `main`, the pinned local custom endpoint
- MLX default output for requests that omit `max_tokens`: 512 tokens
- MLX chat template: `enable_thinking=false`
- MLX prompt concurrency: 1
- MLX decode concurrency: 1
- MLX prefill step: 512 tokens
- Persistent MLX prompt cache: disabled

## Fork behavior

Hermes upstream rejects contexts below 64K, floors small-context compression at 75 percent, and applies a 64K absolute threshold floor. The repository patch makes only two behaviors opt-in through `scripts/hermes-32k.sh`:

1. Accept a 32,000-token startup minimum while keeping the configured 32,768-token context.
2. Honor the configured 40 percent compression threshold without the upstream small-context and absolute floors.

Without the wrapper, upstream defaults remain unchanged. All 166 upstream compressor and anti-thrash tests pass with the override disabled. A fork-mode assertion confirms a 12,288-token trigger.

## Workload and logical result

The final canary used the real Hermes `ContextCompressor` and local 27B model. It built 10 alternating synthetic messages with unique `CANARY_TURN_nn` markers and non-sensitive Queens heritage filler.

Hermes estimated 15,902 tokens before compaction. MLX received an 8,570-token summary prompt. The model returned a real summary, and Hermes reduced the conversation to 4 messages and 7,374 estimated tokens:

```text
CANARY_CONFIG {"context_length": 32768, "max_tokens": 2048, "messages_before": 10, "rough_tokens_before": 15902, "tail_token_budget": 2457, "threshold_tokens": 12288}
CANARY_RESULT {"compression_count": 1, "fallback_used": false, "messages_after": 4, "rough_tokens_after": 7374, "summary_present": true}
COMPACTION_CANARY_OK
```

This proves that the forked 40 percent compaction primitive works. It does not prove that the 27B model is safe on this Mac.

## Hardware safety result

- Memory free before the run: 72 percent
- Swap before the run: 2,461.88 MiB used
- Memory free immediately after the result, while MLX was resident: 24 percent
- Swap immediately after the result: 8,911 MiB used of 9,216 MiB
- Swap growth: about 6.45 GiB during the canary
- Memory free after clean shutdown: 61 percent
- Swap after clean shutdown: 8,855 MiB used
- Metal or GPU error: none observed
- Kernel panic: none
- Remaining MLX, Hermes, or `caffeinate` process after shutdown: none

The swap increase violates the RFC stop rule. The operator stopped MLX immediately after the canary result. January and February must not run on this 27B configuration.

## Earlier calibration attempts

- At the upstream-derived 26,112-token trigger, a canary reduced 38,762 estimated tokens to 17,952 with a real summary and no fallback.
- The first January attempt then showed a 1.27 GiB retained MLX prompt cache and about 683 MiB of swap growth, so persistent prompt caching was disabled.
- Disabling the cache did not solve the underlying 27B memory pressure. The lower 40 percent canary still caused about 6.45 GiB of swap growth.

## Decision

Do not continue the 27B monthly evaluation on this 24 GiB Mac. The next safe option is a smaller local model or a different runtime. The cached `prism-ml/Bonsai-1.7B-mlx-1bit` model is available for a separate capability canary, but changing models requires an explicit evaluation decision because it changes output quality.
