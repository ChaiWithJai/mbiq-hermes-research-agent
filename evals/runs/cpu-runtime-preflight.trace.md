# Bonsai 27B CPU runtime preflight

- **Date:** 2026-07-14, America/New_York
- **Result:** Architecture compatibility passed; full-model canary not started
- **Model intended for canary:** `prism-ml/Ternary-Bonsai-27B-mlx-2bit`
- **Model revision:** `badd9a64565446a6eb8b76583dfa2a62917d8347`
- **MLX:** 0.32.0
- **mlx-lm:** 0.31.3

## Why this path exists

The 27B GPU run caused a macOS kernel panic, and a later GPU compaction canary
added about 6.45 GiB of swap. The repository now selects `mx.cpu` before
importing `mlx_lm.server`. This timing matters because mlx-lm creates its
generation streams at import time.

The 27B checkpoint identifies itself as `qwen3_5`. Most of its layers use a
gated-delta architecture. mlx-lm explicitly selects its operations-based
fallback when the default device is not the GPU.

## Checks completed without loading weights

1. `mlx_lm.server --help` completed through the CPU launcher.
2. MLX reported `Device(cpu, 0)` after the launcher selected the device.
3. A tiny `mlx_lm.models.qwen3_5.GatedDeltaNet` completed a two-token forward
   pass on CPU with output shape `(1, 2, 16)` and finite values.
4. `scripts/start-bonsai.sh` refused to load the 27B weights while swap use was
   4,812.81 MiB, above its 1,024 MiB start limit.

These checks prove that the installed Qwen 3.5 implementation has a working
CPU fallback. They do not prove that the 7.9 GiB checkpoint will complete the
compaction workload within this Mac's memory and time limits.

## Next gate

Reboot the Mac, confirm swap is near zero, and run one observed CPU-only
compaction canary. Record peak resident memory, swap growth, prompt tokens,
wall time, compaction outcome, and whether the desktop stays responsive.
January and February remain blocked from execution until that canary passes.
