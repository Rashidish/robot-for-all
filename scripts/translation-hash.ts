// Prints the translated_from value for an English lesson (more content spec §2.7):
//   npm run translation-hash -- p1-crank-01
// Put it in the translation's front matter after checking the translation against that text.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { translationHash } from '../packages/settings/src/translation.ts';

const id = process.argv[2];
if (!id || !/^p[1-3]-[a-z]+-\d{2}$/.test(id)) {
  console.error('Usage: npm run translation-hash -- <lesson id>, e.g. p1-crank-01');
  process.exit(1);
}
const root = join(import.meta.dirname, '..');
const file = readFileSync(join(root, 'content/lessons', id, 'index.md'), 'utf8');
// The lesson's template sheets count too: changing one makes its translations "need updating".
const folder = join(root, 'content/projects', id, 'templates');
const list = (dir: string): string[] => {
  try {
    return readdirSync(dir).filter((n) => n.endsWith('.ts'));
  } catch {
    return [];
  }
};
const names = list(folder);
const sheets = names.map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }));
console.log(`translated_from: ${await translationHash(file, sheets)}`);
