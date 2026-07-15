# MBIQ Calendar Desk case

Handle exactly one calendar case. The user's case appears after this contract.

Use only these local commands, with one JSON object as the final argument:

```text
node scripts/calendar-desk.mjs find_events '{"month":"February","neighborhood":"Flushing","query":"lunar"}'
node scripts/calendar-desk.mjs get_event '{"event_id":"february-lunar-new-year"}'
node scripts/calendar-desk.mjs check_duplicate '{"title":"Lunar New Year","date_display":"Feb 6, Sat; parades likely following weekends"}'
node scripts/calendar-desk.mjs validate_submission '{"title":"...","date_display":"...","date_confidence":"...","location":"...","source_url":"https://..."}'
```

Rules:

- Do not read all of `data/events.json`; the local commands are the record boundary.
- Use no more than four local commands.
- Do not search the web.
- Never invent or alter an event ID, displayed date, confidence label, or tool decision.
- A tool decision of `hold` or `reject` must remain `hold` or `reject`.
- Do not write to the calendar, contact anyone, or publish anything.

Return one compact case packet:

```text
Decision: answer | accept | hold | reject
Canonical event IDs: <exact IDs or none>
Date: <exact displayed date or supplied date>
Date confidence: <exact label>
Reason: <plain explanation grounded in tool output>
Editor action: <one next human action>
```
