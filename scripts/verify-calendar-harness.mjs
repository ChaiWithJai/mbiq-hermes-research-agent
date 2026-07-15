import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const EXPECTED = {
  id: 'february-lunar-new-year',
  date: 'Feb 6, Sat; parades likely following weekends',
  confidence: 'Confirmed holiday, parade dates TBD',
};

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function verifyCalendarHarness(raw) {
  const text = stripAnsi(raw);
  const errors = [];
  const terminalCalls = [...text.matchAll(/Tool call: terminal with args: ([^\n]+)/g)];
  if (terminalCalls.length !== 1) {
    errors.push(`expected exactly one terminal tool call, found ${terminalCalls.length}`);
  }
  const call = terminalCalls[0]?.[1] ?? '';
  if (!call.includes('scripts/calendar-desk.mjs') || !call.includes('get_event') || !call.includes(EXPECTED.id)) {
    errors.push('terminal call did not invoke get_event for the canonical event ID');
  }

  const roughTokens = [...text.matchAll(/Total message size: ~([\d,]+) tokens/g)]
    .map((match) => Number(match[1].replaceAll(',', '')));
  if (!roughTokens.length) errors.push('missing Hermes request-size trace');
  const largestRoughRequest = roughTokens.length ? Math.max(...roughTokens) : null;
  if (largestRoughRequest !== null && largestRoughRequest > 4096) {
    errors.push(`largest rough request was ${largestRoughRequest} tokens, limit 4096`);
  }

  const required = [
    [/Decision:\s*answer\b/i, 'final decision is not answer'],
    [new RegExp(`Canonical event IDs:\\s*${escapeRegex(EXPECTED.id)}\\b`, 'i'), 'final packet is missing the canonical ID'],
    [new RegExp(`Date:\\s*${escapeRegex(EXPECTED.date)}`, 'i'), 'final packet has the wrong displayed date'],
    [new RegExp(`Date confidence:\\s*${escapeRegex(EXPECTED.confidence)}`, 'i'), 'final packet has the wrong confidence label'],
    [/Reason:\s*\S/i, 'final packet is missing a reason'],
    [/Editor action:\s*\S/i, 'final packet is missing an editor action'],
  ];
  for (const [pattern, message] of required) {
    if (!pattern.test(text)) errors.push(message);
  }

  if (/Tool call: (?:mcp__exa|write_file|patch)\b/.test(text)) {
    errors.push('run used a forbidden Exa or write tool');
  }
  if (!text.includes('provider=custom') || !text.includes('model=default_model')) {
    errors.push('trace does not identify the Hermes custom-provider model path');
  }

  return {
    ok: errors.length === 0,
    errors,
    terminal_calls: terminalCalls.length,
    largest_rough_request_tokens: largestRoughRequest,
    expected: EXPECTED,
  };
}

function selfTest() {
  const passing = `
provider=custom model=default_model
Total message size: ~2,901 tokens
Tool call: terminal with args: {"command":"node scripts/calendar-desk.mjs get_event '{\\"event_id\\":\\"february-lunar-new-year\\"}'"}
Decision: answer
Canonical event IDs: february-lunar-new-year
Date: Feb 6, Sat; parades likely following weekends
Date confidence: Confirmed holiday, parade dates TBD
Reason: Canonical local record returned these fields.
Editor action: Review the calendar answer.
`;
  const passResult = verifyCalendarHarness(passing);
  if (!passResult.ok) throw new Error(`passing self-test failed: ${passResult.errors.join('; ')}`);
  const failResult = verifyCalendarHarness(passing.replace('Decision: answer', 'Decision: hold'));
  if (failResult.ok || !failResult.errors.includes('final decision is not answer')) {
    throw new Error('failing self-test was not rejected');
  }
  console.log('Calendar harness verifier self-test passed.');
}

async function main() {
  const arg = process.argv[2];
  if (arg === '--self-test') {
    selfTest();
    return;
  }
  if (!arg) {
    console.error('Usage: node scripts/verify-calendar-harness.mjs <raw-log>');
    process.exitCode = 2;
    return;
  }
  const result = verifyCalendarHarness(await readFile(arg, 'utf8'));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
