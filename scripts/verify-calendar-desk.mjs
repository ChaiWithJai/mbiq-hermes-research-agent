import { readFile } from 'node:fs/promises';
import { tools } from './calendar-desk.mjs';

const cases = JSON.parse(
  await readFile(new URL('../evals/calendar-desk-cases.json', import.meta.url), 'utf8'),
);
const failures = [];

function matchesSubset(actual, expected, path = 'result') {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      failures.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      return;
    }
    expected.forEach((value, index) => matchesSubset(actual[index], value, `${path}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') {
      failures.push(`${path}: expected object, got ${JSON.stringify(actual)}`);
      return;
    }
    for (const [key, value] of Object.entries(expected)) {
      matchesSubset(actual[key], value, `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) {
    failures.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

for (const testCase of cases) {
  const tool = tools[testCase.tool];
  if (!tool) {
    failures.push(`${testCase.id}: unknown tool ${testCase.tool}`);
    continue;
  }
  const result = tool(testCase.input);
  const size = JSON.stringify(result).length;
  if (size > testCase.max_result_chars) {
    failures.push(`${testCase.id}: result has ${size} characters, limit ${testCase.max_result_chars}`);
  }
  const before = failures.length;
  matchesSubset(result, testCase.expect, testCase.id);
  if (failures.length === before) {
    console.log(`PASS ${testCase.id} (${size} chars)`);
  }
}

if (cases.length !== 10) failures.push(`expected 10 cases, found ${cases.length}`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Verified ${cases.length}/10 Calendar Desk cases within payload limits.`);
