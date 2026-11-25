// Progress from recorded answer sheets (M5 step 6, FR-14 to FR-16; answer-sheets Part B). For
// each learner and lesson the newest record that hasn't been revoked counts. "Not yet" answers
// are shown so a learner knows what to work on; they never count as done (owner decision).
import { sheetBoxes, type SheetSummary } from '../lessons/answers';

export interface ProgressRecord {
  id: string;
  learner_id: string;
  lesson_id: string;
  sheet_code: string;
  steps_done: number;
  i_can: boolean[];
  built_working: boolean;
  team_sheet: boolean;
  recorded_at: string;
  checked_at: string | null;
  revoked_at: string | null;
}

export interface Cell {
  record: ProgressRecord;
  /** Steps ticked and the sheet's total boxes (null when the sheet code is unknown). */
  steps: number;
  boxes: number | null;
  /** The "I can" checks answered "Not yet", in the sheet's words where known. */
  notYet: string[];
  /** Every box ticked, every "I can" a Yes, and built and working. */
  done: boolean;
  checked: boolean;
}

/** The phase of a lesson from its id (p1-…, p2-…, p3-…). */
export const phaseOf = (lessonId: string): number => Number(/^p([1-3])-/.exec(lessonId)?.[1] ?? 0);

export function cellFor(r: ProgressRecord, sheets: Record<string, SheetSummary>): Cell {
  const sheet = sheets[r.sheet_code];
  const boxes = sheet ? sheetBoxes(sheet) : null;
  const notYet = r.i_can.flatMap((yes, i) => (yes ? [] : [sheet?.ican[i] ?? `#${i + 1}`]));
  return {
    record: r,
    steps: r.steps_done,
    boxes,
    notYet,
    done: notYet.length === 0 && r.built_working && (boxes === null || r.steps_done >= boxes),
    checked: r.checked_at !== null
  };
}

/** learner → lesson → cell, from the newest record that hasn't been revoked. */
export function progressGrid(
  records: readonly ProgressRecord[],
  sheets: Record<string, SheetSummary>
): Map<string, Map<string, Cell>> {
  const grid = new Map<string, Map<string, Cell>>();
  const newestFirst = [...records]
    .filter((r) => r.revoked_at === null)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  for (const r of newestFirst) {
    const row = grid.get(r.learner_id) ?? new Map<string, Cell>();
    if (!row.has(r.lesson_id)) row.set(r.lesson_id, cellFor(r, sheets));
    grid.set(r.learner_id, row);
  }
  return grid;
}

/** The lessons that appear in the grid, in lesson order, optionally of one phase. */
export function gridLessons(grid: Map<string, Map<string, Cell>>, phase: number | null): string[] {
  const ids = new Set<string>();
  for (const row of grid.values()) for (const id of row.keys()) ids.add(id);
  return [...ids].filter((id) => phase === null || phaseOf(id) === phase).sort();
}

/** A lesson's title from any sheet of it (the class's language first), else its id. */
export function lessonTitle(
  lessonId: string,
  sheets: Record<string, SheetSummary>,
  lang = 'en'
): string {
  const all = Object.values(sheets).filter((s) => s.lesson === lessonId);
  return (
    (all.find((s) => s.lang === lang) ?? all.find((s) => s.lang === 'en') ?? all[0])?.title ??
    lessonId
  );
}
