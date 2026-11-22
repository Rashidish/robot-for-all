// One-page answer sheet for a printed lesson (answer-sheets spec): the questions learners answer,
// the tables they fill in and the steps they tick off, taken from the lesson's own PRIMM text so a
// sheet never drifts from its lesson. The filled-in sheet is the record a teacher later enters in
// the app for a learner or team.
import { PRIMM_STEPS } from './schema';

export type SheetItem =
  | { kind: 'question'; text: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'steps'; count: number };

export interface SheetSection {
  step: string;
  items: SheetItem[];
}

/** Markdown inline marks to plain text: **bold**, `code`, [links](url) and images. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LIST = /^(\s*)(\d+\.|[-*])\s+(.*)$/;
const TABLE = /^\s*\|(.*)\|\s*$/;
const SEPARATOR = /^\s*\|?\s*:?-{2,}/;
/** Diagram legends: "1. **Crank**: the disc on the axle". Not something to answer. */
const LEGEND = /^\*\*[^*]+\*\*\s*(:.*)?$/;

function cells(line: string): string[] {
  return (TABLE.exec(line)?.[1] ?? '').split('|').map((c) => plainText(c));
}

/** Questions and tasks of one PRIMM section, in order. */
function sectionItems(lines: string[]): SheetItem[] {
  const items: SheetItem[] = [];
  let steps = 0;
  let table: { head: string[]; rows: string[][] } | null = null;
  let current: { text: string; list: boolean } | null = null;

  const flush = () => {
    if (current) {
      const text = plainText(current.text);
      if (current.list && LEGEND.test(current.text.trim())) {
        // skip diagram legends
      } else if (text.includes('?')) {
        items.push({ kind: 'question', text });
      } else if (current.list && text) {
        steps += 1;
      }
    }
    current = null;
  };
  const flushTable = () => {
    if (table) items.push({ kind: 'table', ...table });
    table = null;
  };

  for (const line of lines) {
    if (TABLE.test(line)) {
      flush();
      if (SEPARATOR.test(line.replace(/^\s*\|/, ''))) continue;
      if (!table) table = { head: cells(line), rows: [] };
      else table.rows.push(cells(line));
      continue;
    }
    flushTable();
    if (line.trim() === '' || line.trim().startsWith('![')) {
      flush();
      continue;
    }
    const list = LIST.exec(line);
    if (list && (list[1] ?? '').length < 2) {
      flush();
      current = { text: list[3] ?? '', list: true };
    } else if (current) {
      // Continuation, including a list nested inside an item.
      current.text += ` ${list ? (list[3] ?? '') : line}`;
    } else {
      current = { text: line, list: false };
    }
  }
  flush();
  flushTable();
  if (steps > 0) items.unshift({ kind: 'steps', count: steps });
  return items;
}

/** The answer sheet for a lesson body: one section per PRIMM step (Teacher notes left out). */
export function answerSheet(body: string): SheetSection[] {
  const sections: SheetSection[] = [];
  let step: string | null = null;
  let lines: string[] = [];
  const close = () => {
    // Make is open-ended: the sheet gives it a box instead of separate questions.
    if (step) sections.push({ step, items: step === 'Make' ? [] : sectionItems(lines) });
  };
  for (const line of body.split('\n')) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      close();
      const name = heading[1] ?? '';
      step = (PRIMM_STEPS as readonly string[]).includes(name) ? name : null;
      lines = [];
    } else if (step) {
      lines.push(line);
    }
  }
  close();
  return sections;
}

/**
 * True when the sheet would not fit on one A4 page with two answer lines per question; it then
 * prints one line each. The weights are millimetres measured from printed sheets.
 */
export function sheetIsDense(sections: SheetSection[]): boolean {
  let questions = 0;
  let characters = 0;
  let tableRows = 0;
  for (const item of sections.flatMap((s) => s.items)) {
    if (item.kind === 'question') {
      questions += 1;
      characters += item.text.length;
    } else if (item.kind === 'table') {
      tableRows += item.rows.length + 1;
    }
  }
  return questions * 11 + (characters / 95 + questions) * 4.2 + tableRows * 5 > 170;
}
