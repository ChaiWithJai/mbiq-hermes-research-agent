#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW_LOG="${MBIQ_CALENDAR_RAW_LOG:-$ROOT/evals/runs/calendar-known-event.raw.log}"
SERVER_LOG="${MBIQ_SERVER_LOG:-$ROOT/evals/runs/calendar-server.raw.log}"
METRICS_LOG="${MBIQ_CALENDAR_METRICS_LOG:-$ROOT/evals/runs/calendar-metrics.raw.log}"
MAX_START_SWAP_MB="${MBIQ_MAX_START_SWAP_MB:-1024}"
MIN_START_FREE_PERCENT="${MBIQ_MIN_START_FREE_PERCENT:-50}"
MAX_SWAP_GROWTH_MB="${MBIQ_MAX_SWAP_GROWTH_MB:-1024}"
MIN_FREE_PERCENT="${MBIQ_MIN_FREE_PERCENT:-25}"
MAX_SERVER_RSS_MB="${MBIQ_MAX_SERVER_RSS_MB:-16384}"
READY_TIMEOUT_SECONDS="${MBIQ_READY_TIMEOUT_SECONDS:-600}"
JOB_TIMEOUT_SECONDS="${MBIQ_JOB_TIMEOUT_SECONDS:-900}"

swap_used_mb() {
  sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/'
}

free_percent() {
  memory_pressure -Q 2>/dev/null | awk '/System-wide memory free percentage:/ { gsub(/%/, "", $5); print $5 }'
}

BASELINE_SWAP_MB="$(swap_used_mb)"
BASELINE_FREE_PERCENT="$(free_percent)"
if curl --silent --max-time 1 http://127.0.0.1:8080/v1/models >/dev/null 2>&1; then
  echo "Refusing canary: port 8080 already has a model endpoint. Stop it first." >&2
  exit 1
fi
if awk -v value="$BASELINE_SWAP_MB" -v limit="$MAX_START_SWAP_MB" 'BEGIN { exit !(value > limit) }'; then
  echo "Refusing canary: swap is ${BASELINE_SWAP_MB} MiB (limit ${MAX_START_SWAP_MB} MiB). Reboot first." >&2
  exit 1
fi
if [[ -z "$BASELINE_FREE_PERCENT" ]] || awk -v value="$BASELINE_FREE_PERCENT" -v limit="$MIN_START_FREE_PERCENT" 'BEGIN { exit !(value < limit) }'; then
  echo "Refusing canary: free memory is ${BASELINE_FREE_PERCENT:-unknown}% (floor ${MIN_START_FREE_PERCENT}%)." >&2
  exit 1
fi

SERVER_PID=""
HERMES_PID=""
cleanup() {
  local pid
  for pid in "$HERMES_PID" "$SERVER_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 1
  for pid in "$HERMES_PID" "$SERVER_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

START_EPOCH="$(date +%s)"
printf 'elapsed_seconds\tswap_used_mb\tswap_growth_mb\tfree_percent\tserver_rss_mb\n' > "$METRICS_LOG"

sample_and_guard() {
  local now elapsed swap growth free rss
  now="$(date +%s)"
  elapsed=$((now - START_EPOCH))
  swap="$(swap_used_mb)"
  growth="$(awk -v now="$swap" -v base="$BASELINE_SWAP_MB" 'BEGIN { printf "%.2f", now - base }')"
  free="$(free_percent)"
  rss=0
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    rss="$(ps -o rss= -p "$SERVER_PID" | awk '{ printf "%.2f", $1 / 1024 }')"
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$elapsed" "$swap" "$growth" "${free:-0}" "${rss:-0}" >> "$METRICS_LOG"

  if awk -v value="$growth" -v limit="$MAX_SWAP_GROWTH_MB" 'BEGIN { exit !(value > limit) }'; then
    echo "CANARY_ABORT: swap grew ${growth} MiB (limit ${MAX_SWAP_GROWTH_MB} MiB)" >&2
    return 1
  fi
  if [[ -z "$free" ]] || awk -v value="$free" -v limit="$MIN_FREE_PERCENT" 'BEGIN { exit !(value < limit) }'; then
    echo "CANARY_ABORT: free memory is ${free:-unknown}% (floor ${MIN_FREE_PERCENT}%)" >&2
    return 1
  fi
  if awk -v value="${rss:-0}" -v limit="$MAX_SERVER_RSS_MB" 'BEGIN { exit !(value > limit) }'; then
    echo "CANARY_ABORT: server RSS is ${rss} MiB (limit ${MAX_SERVER_RSS_MB} MiB)" >&2
    return 1
  fi
}

echo "Starting exact Bonsai 27B CPU calendar canary."
"$ROOT/scripts/start-bonsai.sh" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

ready_start="$(date +%s)"
while ! curl --silent --fail --max-time 2 http://127.0.0.1:8080/v1/models >/dev/null 2>&1; do
  sample_and_guard
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    wait "$SERVER_PID" || true
    echo "Bonsai server exited before readiness. See $SERVER_LOG" >&2
    exit 1
  fi
  if (( $(date +%s) - ready_start > READY_TIMEOUT_SECONDS )); then
    echo "CANARY_ABORT: server readiness exceeded ${READY_TIMEOUT_SECONDS}s" >&2
    exit 1
  fi
  sleep 2
done

QUERY="$(cat "$ROOT/prompts/calendar-desk.md"; printf '\n\n'; cat "$ROOT/evals/prompts/calendar-known-event.txt")"
(
  cd "$ROOT"
  exec scripts/hermes-32k.sh chat -v --yolo -t terminal --max-turns 4 -q "$QUERY"
) >"$RAW_LOG" 2>&1 &
HERMES_PID=$!
job_start="$(date +%s)"

while kill -0 "$HERMES_PID" 2>/dev/null; do
  sample_and_guard
  if (( $(date +%s) - job_start > JOB_TIMEOUT_SECONDS )); then
    echo "CANARY_ABORT: Calendar Desk job exceeded ${JOB_TIMEOUT_SECONDS}s" >&2
    exit 1
  fi
  sleep 2
done

wait "$HERMES_PID"
HERMES_PID=""
sample_and_guard
node "$ROOT/scripts/verify-calendar-harness.mjs" "$RAW_LOG"
echo "CALENDAR_HERMES_CANARY_OK"
