// Adds this build's answer sheet codes to content/sheets/codes.json (answer-sheets spec Part B),
// so sheets printed before a lesson changes can still be recorded. The file only grows.
// Run after `npm run build`: npm run sheet-codes
import { readFileSync, writeFileSync } from 'node:fs';

const built = JSON.parse(readFileSync('apps/web/dist/sheets.json', 'utf8'));
const file = 'content/sheets/codes.json';
const past = JSON.parse(readFileSync(file, 'utf8'));
let added = 0;
for (const code of built.current) {
  if (!past[code]) {
    past[code] = built.sheets[code];
    added += 1;
  }
}
const sorted = Object.fromEntries(
  Object.keys(past)
    .sort()
    .map((k) => [k, past[k]])
);
writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`${added} new sheet code(s) added; ${Object.keys(sorted).length} in all.`);
