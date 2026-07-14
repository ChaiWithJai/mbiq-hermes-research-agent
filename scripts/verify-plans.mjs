import { readFile } from 'node:fs/promises';

const calendar = JSON.parse(await readFile('data/events.json', 'utf8'));
const specs = [
  { month: 'January', plan: 'briefs/2027-january-plan.md', trace: 'evals/runs/january.trace.md', maxAdvance: 3 },
  { month: 'February', plan: 'briefs/2027-february-plan.md', trace: 'evals/runs/february.trace.md', maxAdvance: 4 }
];
const errors = [];

for (const spec of specs) {
  let plan;
  let trace;
  try {
    [plan, trace] = await Promise.all([
      readFile(spec.plan, 'utf8'),
      readFile(spec.trace, 'utf8')
    ]);
  } catch (error) {
    errors.push(`${spec.month}: missing plan or sanitized Hermes trace (${error.message})`);
    continue;
  }

  const events = calendar.events.filter((event) => event.month === spec.month);
  for (const event of events) {
    for (const [label, value] of [
      ['event ID', event.id],
      ['date display', event.date_display],
      ['date confidence', event.date_confidence]
    ]) {
      if (!plan.includes(value)) errors.push(`${spec.month}: ${event.id} is missing exact ${label}: ${value}`);
    }
  }

  const planLines = plan.split('\n');
  const decisions = new Map();
  for (const event of events) {
    const decisionRows = planLines.filter((line) => line.trim().startsWith('|') && line.includes(event.id) && /\b(advance|hold|reject)\b/i.test(line));
    if (decisionRows.length !== 1) {
      errors.push(`${spec.month}: expected one canonical decision row for ${event.id}, found ${decisionRows.length}`);
      continue;
    }
    decisions.set(event.id, decisionRows[0].match(/\b(advance|hold|reject)\b/i)[1].toLowerCase());
  }
  const advanceCount = [...decisions.values()].filter((decision) => decision === 'advance').length;
  if (advanceCount > spec.maxAdvance) {
    errors.push(`${spec.month}: advances ${advanceCount} events; maximum is ${spec.maxAdvance}`);
  }
  if (!/human editorial review/i.test(plan)) errors.push(`${spec.month}: missing human editorial review gate`);

  const urls = new Set(plan.match(/https?:\/\/[^\s)>\]]+/g) || []);
  if (urls.size < 5) errors.push(`${spec.month}: found ${urls.size} source URLs; expected at least 5`);

  for (const marker of ['Hermes version', 'Model', 'Endpoint', 'Prompt', 'Exa', 'Rubric', 'Manual citation audit']) {
    if (!trace.toLowerCase().includes(marker.toLowerCase())) errors.push(`${spec.month}: trace missing ${marker}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Verified January and February plans and sanitized Hermes traces.');
