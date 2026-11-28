// Prints the translated_from value for an English lesson (more content spec §2.7) or Machines
// topic (machines spec FR-10):
//   npm run translation-hash -- p1-crank-01
//   npm run translation-hash -- bushing
// Put it in the translation's front matter after checking the translation against that text.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { translationHash } from '../packages/settings/src/translation.ts';

const id = process.argv[2] ?? '';
const root = join(import.meta.dirname, '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

if (/^p[1-3]-[a-z]+-\d{2}$/.test(id)) {
  const file = read('content/lessons', id, 'index.md');
  // The lesson's template sheets count too: changing one makes its translations "need updating".
  const folder = join(root, 'content/projects', id, 'templates');
  const names = existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith('.ts')) : [];
  const sheets = names.map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }));
  console.log(`translated_from: ${await translationHash(file, sheets)}`);
} else if (/^[a-z]+(-[a-z]+)*$/.test(id) && existsSync(join(root, 'content/machines', id))) {
  // A topic: its index.md and its picture (new callouts make translations "need updating").
  const file = read('content/machines', id, 'index.md');
  const svg = join(root, 'content/machines', id, 'picture.svg');
  const picture = existsSync(svg) ? [{ name: 'picture.svg', text: readFileSync(svg, 'utf8') }] : [];
  console.log(`translated_from: ${await translationHash(file, picture)}`);
} else {
  console.error(
    'Usage: npm run translation-hash -- <lesson id or Machines topic id>, e.g. p1-crank-01 or bushing'
  );
  process.exit(1);
}
