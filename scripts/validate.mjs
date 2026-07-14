import { readFile } from 'node:fs/promises';

const calendar = JSON.parse(await readFile('data/events.json', 'utf8'));
const cases = JSON.parse(await readFile('evals/cases.json', 'utf8'));
const errors = [];

if (calendar.metadata.event_count !== calendar.events.length) errors.push('metadata event_count does not match events');
if (calendar.events.length !== 109) errors.push(`expected 109 events, found ${calendar.events.length}`);
const ids = new Set();
for (const event of calendar.events) {
  for (const field of ['id', 'month', 'date_display', 'date_confidence', 'title', 'summary', 'category', 'type', 'location']) {
    if (!event[field]) errors.push(`${event.id || '(missing id)'}: missing ${field}`);
  }
  if (ids.has(event.id)) errors.push(`duplicate id: ${event.id}`);
  ids.add(event.id);
  if (!Array.isArray(event.research_notes) || !Array.isArray(event.source_labels)) errors.push(`${event.id}: notes or sources are not arrays`);
}
if (cases.length < 5) errors.push('job evaluation suite is incomplete');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validated ${calendar.events.length} unique events and ${cases.length} job-level eval cases.`);

