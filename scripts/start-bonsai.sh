#!/usr/bin/env bash
set -euo pipefail

# T7 is NTFS and read-only on this Mac, so use an explicit writable local cache.
export HF_HOME="${MBIQ_HF_HOME:-$HOME/.cache/huggingface-local}"
export HF_HUB_DISABLE_XET=1
export HF_HUB_DOWNLOAD_TIMEOUT=600
export HF_HUB_ETAG_TIMEOUT=60

# Resolve the exact downloaded snapshot rather than following a moving main branch.
MODEL_REVISION="${MBIQ_MODEL_REVISION:-badd9a64565446a6eb8b76583dfa2a62917d8347}"
MODEL_PATH="$HF_HOME/hub/models--prism-ml--Ternary-Bonsai-27B-mlx-2bit/snapshots/$MODEL_REVISION"

if [[ ! -f "$MODEL_PATH/model.safetensors" ]]; then
  echo "Missing model weights at $MODEL_PATH/model.safetensors" >&2
  echo "Finish the pinned model download before starting the server." >&2
  exit 1
fi

exec "$HOME/.local/bin/mlx_lm.server" \
  --model "$MODEL_PATH" \
  --host 127.0.0.1 \
  --port 8080 \
  --max-tokens "${MBIQ_MAX_TOKENS:-8192}"
