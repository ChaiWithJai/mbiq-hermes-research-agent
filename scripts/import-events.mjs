import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const PAGE_URL = 'https://mbiq-research-hub.netlify.app/';
const YEAR = 2027;
const output = resolve(process.argv[2] || 'data/events.json');

function findBalancedArray(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Could not find ${marker}`);
  const start = source.indexOf('[', markerIndex + marker.length);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('Calendar array did not close');
}

function slug(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const page = await fetch(PAGE_URL).then((response) => {
  if (!response.ok) throw new Error(`Page returned ${response.status}`);
  return response.text();
});
const chunkPath = page.match(/src="([^"]*0ppql3uns4bmb\.js)"/)?.[1];
if (!chunkPath) throw new Error('Could not locate the calendar JavaScript chunk');
const chunkUrl = new URL(chunkPath, PAGE_URL);
const source = await fetch(chunkUrl).then((response) => {
  if (!response.ok) throw new Error(`Chunk returned ${response.status}`);
  return response.text();
});

const literal = findBalancedArray(source, 'eB=');
const rawEvents = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
if (!Array.isArray(rawEvents) || rawEvents.length !== 109) {
  throw new Error(`Expected 109 events, found ${rawEvents?.length ?? 'invalid data'}`);
}

const seen = new Set();
const events = rawEvents.map((event) => {
  const base = `${event.month}-${event.title}`;
  let id = slug(base);
  let suffix = 2;
  while (seen.has(id)) id = `${slug(base)}-${suffix++}`;
  seen.add(id);
  const notes = Array.isArray(event.extra) ? event.extra : [];
  const sourceNote = notes.find((note) => note.startsWith('Sources:')) || '';
  return {
    id,
    year: YEAR,
    month: event.month,
    date_display: event.date,
    date_confidence: event.confidence,
    title: event.title,
    summary: event.desc,
    category: event.category,
    type: event.type,
    location: event.location,
    research_notes: notes.filter((note) => !note.startsWith('Sources:')),
    source_labels: sourceNote.replace(/^Sources:\s*/, '').split(';').map((value) => value.trim()).filter(Boolean)
  };
});

const document = {
  metadata: {
    source_url: PAGE_URL,
    source_chunk_url: chunkUrl.href,
    year: YEAR,
    event_count: events.length,
    imported_at: new Date().toISOString(),
    note: 'Dates retain the source display text and confidence label. Expected dates must be rechecked before publication.'
  },
  events
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Wrote ${events.length} events to ${output}`);

