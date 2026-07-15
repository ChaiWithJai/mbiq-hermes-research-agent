# MBIQ Calendar Desk tool contract

Experiment 002 separates business rules from model judgment. Hermes may choose
which operation to call, but JavaScript owns record lookup, duplicate detection,
Queens-scope validation, and the canonical routing decision.

## Command boundary

```bash
node scripts/calendar-desk.mjs <tool_name> '<one JSON object>'
```

The process writes one compact JSON result to standard output. Business errors
are structured results. Invalid CLI syntax exits with code 2. Every successful
or error result is capped at 2,000 serialized characters.

## Operations

### `find_events`

Input fields:

- `month` (optional)
- `neighborhood` (optional)
- `query` (optional)

At least one filter is required. The result contains at most five canonical,
non-duplicate event records and never includes research notes.

### `get_event`

Input: `event_id`, required. The result is one compact canonical record or an
`event_not_found` error. This is the only supported way for the acceptance
agent to claim that an ID exists.

### `check_duplicate`

Input: `title`, required, plus optional `date_display`. Titles are compared
after case, punctuation, spacing, and accent normalization. Same title and
same displayed date is `exact`; same title with a different or omitted date is
`probable`. Results are capped at three matches.

### `validate_submission`

Required input:

- `title`
- `date_display`
- `date_confidence`
- `location`
- `source_url`

The function returns `accept`, `hold`, or `reject`:

| Condition | Decision |
| --- | --- |
| Exact duplicate | `reject` |
| Explicitly outside Queens | `reject` |
| Missing required field | `hold` |
| Queens relevance unclear | `hold` |
| Date-confidence label is not already in the calendar vocabulary | `hold` |
| Source URL is invalid | `hold` |
| Probable duplicate | `hold` |
| All deterministic checks pass | `accept` |

The supplied confidence label is preserved in the result. The tool never
converts an estimated or unsupported label into a confirmed one.

## Model boundary

The model may explain a result and draft an editor handoff. It may not override
the result, invent IDs, read the full dataset, mutate the calendar, or exceed
four tool calls. Exa is absent from the first ten cases. A later phase may add
one fetch of a URL already supplied by the user; broad search remains out of
scope for experiment 002.

## Deterministic evidence

`evals/calendar-desk-cases.json` contains ten cases covering bounded lookup,
known and invented IDs, exact duplicates, acceptance, missing evidence,
unclear Queens relevance, outside-Queens rejection, and unsupported confidence
language. `npm run calendar:test` executes every case and enforces its payload
limit without loading a model.

## Exact-model canary

After rebooting and confirming swap is near zero, run:

```bash
scripts/run-calendar-canary.sh
```

The runner starts the exact Bonsai 27B checkpoint on MLX CPU, gives Hermes only
the terminal tool, and runs the known-event case in
`evals/prompts/calendar-known-event.txt`. It samples resources every two
seconds and aborts above 1 GiB of swap growth, below 25 percent free memory,
above 16 GiB server RSS, or after 15 minutes. It always stops Hermes and the
model server.

The trace verifier requires exactly one `get_event` terminal call, the exact
canonical ID, displayed date, and confidence label, an `answer` decision, a
maximum 4,096-token rough request estimate, and no Exa or write tool call.
