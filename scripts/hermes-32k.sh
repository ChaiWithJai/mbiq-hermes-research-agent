#!/usr/bin/env bash
set -euo pipefail

# Hermes upstream defaults to a 64K minimum. The pinned local checkout carries
# patches/hermes-32k-minimum.patch, which makes that floor explicitly overridable.
# Keep the override scoped to this command instead of changing global Hermes use.
export HERMES_STARTUP_MINIMUM_CONTEXT_LENGTH=32000
export HERMES_ALLOW_LOW_CONTEXT_COMPRESSION_THRESHOLD=1

exec hermes "$@"
