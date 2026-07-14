#!/usr/bin/env bash
set -euo pipefail

# T7 is NTFS and read-only on this Mac, so use an explicit writable local cache.
export HF_HOME="${MBIQ_HF_HOME:-$HOME/.cache/huggingface-local}"
exec "$HOME/.local/bin/mlx_lm.server" \
  --model prism-ml/Ternary-Bonsai-27B-mlx-2bit \
  --host 127.0.0.1 \
  --port 8080

