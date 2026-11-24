// Prints the translated_from value for an English lesson (more content spec §2.7):
//   npm run translation-hash -- p1-crank-01
// Put it in the translation's front matter after checking the translation against that text.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { translationHash } from '../packages/settings/src/translation.ts';

const id = process.argv[2];
if (!id || !/^p[1-3]-[a-z]+-\d{2}$/.test(id)) {
  console.error('Usage: npm run translation-hash -- <lesson id>, e.g. p1-crank-01');
  process.exit(1);
}
const file = readFileSync(
  join(import.meta.dirname, '..', 'content/lessons', id, 'index.md'),
  'utf8'
);
console.log(`translated_from: ${await translationHash(file)}`);
