#!/usr/bin/env bash
set -euo pipefail

# T7 is NTFS and read-only on this Mac, so use an explicit writable local cache.
export HF_HOME="${MBIQ_HF_HOME:-$HOME/.cache/huggingface-local}"
export HF_HUB_DISABLE_XET=1
export HF_HUB_DOWNLOAD_TIMEOUT=600
export HF_HUB_ETAG_TIMEOUT=60

# The 27B Metal path caused a kernel panic and later unsafe swap growth on this
# 24 GiB Mac. Keep inference on CPU unless a future, separately reviewed
# hardware profile explicitly replaces this launcher.
MLX_LM_PYTHON="${MBIQ_MLX_LM_PYTHON:-$HOME/.local/share/uv/tools/mlx-lm/bin/python}"
if [[ ! -x "$MLX_LM_PYTHON" ]]; then
  echo "Missing mlx-lm Python runtime at $MLX_LM_PYTHON" >&2
  exit 1
fi

# A reboot should leave swap near zero. Starting while old swap is still
# resident makes a canary ambiguous and removes the machine's safety margin.
SWAP_USED_MB="$(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/')"
MAX_START_SWAP_MB="${MBIQ_MAX_START_SWAP_MB:-1024}"
if ! awk -v used="$SWAP_USED_MB" -v max="$MAX_START_SWAP_MB" 'BEGIN { exit !(used <= max) }'; then
  echo "Refusing to start: swap use is ${SWAP_USED_MB} MiB (limit ${MAX_START_SWAP_MB} MiB)." >&2
  echo "Reboot this Mac, then rerun the bounded canary." >&2
  exit 1
fi

# Resolve the exact downloaded snapshot rather than following a moving main branch.
MODEL_REVISION="${MBIQ_MODEL_REVISION:-badd9a64565446a6eb8b76583dfa2a62917d8347}"
MODEL_PATH="$HF_HOME/hub/models--prism-ml--Ternary-Bonsai-27B-mlx-2bit/snapshots/$MODEL_REVISION"
EXPECTED_MODEL_SHA256="8acd4597893ea7004e2d7336c3cf6e3157b8896592bbcf066db004021e45846b"

if [[ ! -f "$MODEL_PATH/model.safetensors" ]]; then
  echo "Missing model weights at $MODEL_PATH/model.safetensors" >&2
  echo "Finish the pinned model download before starting the server." >&2
  exit 1
fi

ACTUAL_MODEL_SHA256="$(shasum -a 256 "$MODEL_PATH/model.safetensors" | awk '{print $1}')"
if [[ "$ACTUAL_MODEL_SHA256" != "$EXPECTED_MODEL_SHA256" ]]; then
  echo "Model checksum failed: expected $EXPECTED_MODEL_SHA256, got $ACTUAL_MODEL_SHA256" >&2
  exit 1
fi

# Hermes sends its 2,048-token limit on normal turns. Compression deliberately
# omits that request field, so this smaller server default bounds summaries.
exec "$MLX_LM_PYTHON" "$(dirname "$0")/mlx-lm-server-cpu.py" \
  --model "$MODEL_PATH" \
  --host 127.0.0.1 \
  --port 8080 \
  --max-tokens "${MBIQ_SERVER_DEFAULT_MAX_TOKENS:-512}" \
  --chat-template-args '{"enable_thinking":false}' \
  --decode-concurrency 1 \
  --prompt-concurrency 1 \
  --prefill-step-size "${MBIQ_PREFILL_STEP_SIZE:-512}" \
  --prompt-cache-size 0 \
  --prompt-cache-bytes 0
