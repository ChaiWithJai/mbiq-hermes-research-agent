#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const calendar = JSON.parse(
  await readFile(new URL('../data/events.json', import.meta.url), 'utf8'),
);
const events = calendar.events;
const confidenceLabels = new Set(events.map((event) => event.date_confidence));
const RESULT_LIMIT = 2000;

const queensPlaces = [
  'queens', 'astoria', 'auburndale', 'bayside', 'bellerose', 'briarwood',
  'cambria heights', 'college point', 'corona', 'douglaston', 'east elmhurst',
  'elmhurst', 'far rockaway', 'flushing', 'forest hills', 'fresh meadows',
  'glendale', 'hollis', 'howard beach', 'jackson heights', 'jamaica',
  'kew gardens', 'laurelton', 'little neck', 'long island city', 'maspeth',
  'middle village', 'ozone park', 'queens village', 'rego park', 'richmond hill',
  'ridgewood', 'rockaway', 'rosedale', 'south jamaica', 'st. albans',
  'st albans', 'sunnyside', 'whitestone', 'woodhaven', 'woodside',
];
const outsidePlaces = [
  'bronx', 'brooklyn', 'manhattan', 'staten island', 'harlem', 'elmont',
  'long island', 'new jersey',
];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactEvent(event) {
  return {
    id: event.id,
    title: event.title,
    month: event.month,
    date_display: event.date_display,
    date_confidence: event.date_confidence,
    location: event.location,
    category: event.category,
    duplicate_of: event.duplicate_of,
  };
}

function bounded(result) {
  const size = JSON.stringify(result).length;
  if (size > RESULT_LIMIT) {
    throw new Error(`calendar tool result exceeded ${RESULT_LIMIT} characters: ${size}`);
  }
  return result;
}

function failure(code, message) {
  return bounded({ ok: false, error: { code, message } });
}

export function findEvents(input = {}) {
  const month = normalize(input.month);
  const neighborhood = normalize(input.neighborhood);
  const query = normalize(input.query);
  if (!month && !neighborhood && !query) {
    return failure('missing_filter', 'Provide month, neighborhood, or query.');
  }

  const matches = events
    .filter((event) => !event.duplicate_of)
    .filter((event) => !month || normalize(event.month) === month)
    .filter((event) => !neighborhood || normalize(event.location).includes(neighborhood))
    .filter((event) => {
      if (!query) return true;
      const haystack = normalize([
        event.title, event.summary, event.category, event.type, event.location,
      ].join(' '));
      return haystack.includes(query);
    })
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 5)
    .map(compactEvent);

  return bounded({ ok: true, count: matches.length, events: matches });
}

export function getEvent(input = {}) {
  const id = String(input.event_id ?? '').trim();
  if (!id) return failure('missing_event_id', 'Provide event_id.');
  const event = events.find((candidate) => candidate.id === id);
  if (!event) return failure('event_not_found', `No event has ID ${id}.`);
  return bounded({ ok: true, event: compactEvent(event) });
}

export function checkDuplicate(input = {}) {
  const title = normalize(input.title);
  const date = normalize(input.date_display);
  if (!title) return failure('missing_title', 'Provide title.');

  const matches = events
    .filter((event) => normalize(event.title) === title)
    .map((event) => ({
      ...compactEvent(event),
      match: date && normalize(event.date_display) === date ? 'exact' : 'probable',
    }))
    .sort((a, b) => {
      if (a.match !== b.match) return a.match === 'exact' ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 3);

  return bounded({
    ok: true,
    duplicate: matches.some((match) => match.match === 'exact'),
    matches,
  });
}

function locationClass(input) {
  const text = normalize(`${input.borough ?? ''} ${input.location ?? ''}`);
  if (queensPlaces.some((place) => text.includes(normalize(place)))) return 'queens';
  if (outsidePlaces.some((place) => text.includes(normalize(place)))) return 'outside';
  return 'unclear';
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateSubmission(input = {}) {
  const required = ['title', 'date_display', 'date_confidence', 'location', 'source_url'];
  const missing = required.filter((field) => !String(input[field] ?? '').trim());
  if (missing.length) {
    return bounded({
      ok: true,
      decision: 'hold',
      reasons: missing.map((field) => `missing_${field}`),
      canonical_event_ids: [],
    });
  }

  const duplicateResult = checkDuplicate(input);
  const exactIds = duplicateResult.matches
    .filter((match) => match.match === 'exact')
    .map((match) => match.duplicate_of || match.id);
  const probableIds = duplicateResult.matches
    .filter((match) => match.match === 'probable')
    .map((match) => match.duplicate_of || match.id);
  const uniqueExactIds = [...new Set(exactIds)];
  const uniqueProbableIds = [...new Set(probableIds)];

  if (uniqueExactIds.length) {
    return bounded({
      ok: true,
      decision: 'reject',
      reasons: ['exact_duplicate'],
      canonical_event_ids: uniqueExactIds,
    });
  }

  const place = locationClass(input);
  if (place === 'outside') {
    return bounded({
      ok: true,
      decision: 'reject',
      reasons: ['outside_queens'],
      canonical_event_ids: uniqueProbableIds,
    });
  }

  const holdReasons = [];
  if (place === 'unclear') holdReasons.push('queens_relevance_unverified');
  if (!confidenceLabels.has(input.date_confidence)) holdReasons.push('unsupported_date_confidence');
  if (!validUrl(input.source_url)) holdReasons.push('invalid_source_url');
  if (uniqueProbableIds.length) holdReasons.push('probable_duplicate');

  return bounded({
    ok: true,
    decision: holdReasons.length ? 'hold' : 'accept',
    reasons: holdReasons.length ? holdReasons : ['schema_and_scope_passed'],
    canonical_event_ids: uniqueProbableIds,
    preserved_date_confidence: input.date_confidence,
  });
}

export const tools = {
  find_events: findEvents,
  get_event: getEvent,
  check_duplicate: checkDuplicate,
  validate_submission: validateSubmission,
};

async function runCli() {
  const [toolName, rawInput = '{}'] = process.argv.slice(2);
  if (!tools[toolName]) {
    console.error(`Unknown tool. Choose one of: ${Object.keys(tools).join(', ')}`);
    process.exitCode = 2;
    return;
  }
  let input;
  try {
    input = JSON.parse(rawInput);
  } catch {
    console.error('Input must be one JSON object.');
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(tools[toolName](input)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
