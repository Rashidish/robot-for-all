// Build-time only: reads the sample lesson and turns it into HTML. Never shipped to the browser.
// Paths are relative to the prototype folder, where the build runs.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';

const lessonsDir = resolve(process.cwd(), '../../content/lessons');

export const lessonIds = ['p1-crank-01'];

export function loadLesson(id) {
  const raw = readFileSync(`${lessonsDir}/${id}/index.md`, 'utf8');
  const [, frontMatter, body] = raw.split(/^---$/m);
  const title = /^title:\s*(.+)$/m.exec(frontMatter)?.[1] ?? id;
  return { id, title, html: marked.parse(body) };
}
