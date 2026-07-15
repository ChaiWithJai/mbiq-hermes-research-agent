import { readFile } from 'node:fs/promises';

const calendar = JSON.parse(await readFile('data/events.json', 'utf8'));
const cases = JSON.parse(await readFile('evals/cases.json', 'utf8'));
const calendarDeskCases = JSON.parse(await readFile('evals/calendar-desk-cases.json', 'utf8'));
const errors = [];

if (calendar.metadata.event_count !== calendar.events.length) errors.push('metadata event_count does not match events');
if (calendar.events.length !== 109) errors.push(`expected 109 events, found ${calendar.events.length}`);
if (calendar.metadata.duplicate_count !== 3) errors.push(`expected 3 marked duplicates, found ${calendar.metadata.duplicate_count}`);
const ids = new Set();
for (const event of calendar.events) {
  for (const field of ['id', 'month', 'date_display', 'date_confidence', 'title', 'summary', 'category', 'type', 'location']) {
    if (!event[field]) errors.push(`${event.id || '(missing id)'}: missing ${field}`);
  }
  if (ids.has(event.id)) errors.push(`duplicate id: ${event.id}`);
  ids.add(event.id);
  if (!Array.isArray(event.research_notes) || !Array.isArray(event.source_labels)) errors.push(`${event.id}: notes or sources are not arrays`);
}
for (const event of calendar.events.filter((item) => item.duplicate_of)) {
  if (!ids.has(event.duplicate_of)) errors.push(`${event.id}: duplicate_of target does not exist`);
}
if (cases.length < 5) errors.push('job evaluation suite is incomplete');
if (calendarDeskCases.length !== 10) errors.push(`expected 10 Calendar Desk cases, found ${calendarDeskCases.length}`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validated ${calendar.events.length} source records (${calendar.metadata.duplicate_count} marked duplicates), ${cases.length} research cases, and ${calendarDeskCases.length} Calendar Desk cases.`);
