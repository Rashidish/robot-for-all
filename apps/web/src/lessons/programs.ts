// Starter programs for Phase 2 lessons (M3 spec FR-10): content/lessons/<id>/programs/<name>.rfa.json.
// They are checked at build time like an imported file, and passed to the editor inside the
// link (#open=...), so "Open in code editor" works offline and needs no extra download.
import { fromFile, type ProgramFile } from '../code/files';

const files = import.meta.glob<string>('../../../../content/lessons/*/programs/*.rfa.json', {
  eager: true,
  query: '?raw',
  import: 'default'
});

function source(lesson: string, name: string): string | undefined {
  const suffix = `/${lesson}/programs/${name}.rfa.json`;
  return Object.entries(files).find(([path]) => path.endsWith(suffix))?.[1];
}

export function findProgram(lesson: string, name: string): ProgramFile | undefined {
  const text = source(lesson, name);
  return text === undefined ? undefined : fromFile(text);
}

/** The editor link that opens a lesson's starter program, and its robot world if it has one. */
export function starterLink(
  lesson: string,
  name: string,
  world?: string | null
): string | undefined {
  const text = source(lesson, name);
  if (text === undefined) return undefined;
  fromFile(text); // throws (failing the build) if the program isn't valid
  const bytes = new TextEncoder().encode(text);
  const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
  const open = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `/code/#open=${open}${world ? `&world=${world}` : ''}`;
}
