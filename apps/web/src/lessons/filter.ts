// Lesson library filters (M2 spec FR-9). Pure logic, shared by the page script and unit tests.

export interface Filters {
  grade: number | null;
  mechanism: string | null;
  /** Highest cost in rand, or null for any. */
  maxCost: number | null;
  /** A Machines topic the lesson uses (machines spec FR-13), or null for any. */
  machine: string | null;
}

export interface Filterable {
  grades: number[];
  mechanism: string;
  cost: number;
  machines: string[];
}

export function matches(lesson: Filterable, f: Filters): boolean {
  return (
    (f.grade === null || lesson.grades.includes(f.grade)) &&
    (f.mechanism === null || lesson.mechanism === f.mechanism) &&
    (f.maxCost === null || lesson.cost <= f.maxCost) &&
    (f.machine === null || lesson.machines.includes(f.machine))
  );
}

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

const word = (v: string | null) => (v && /^[a-z-]+$/.test(v) ? v : null);

/** Reads filters from a URL query (?grade=4&mechanism=gear&cost=10&machine=crank); bad values
 * mean "any". */
export function fromQuery(params: URLSearchParams): Filters {
  return {
    grade: num(params.get('grade')),
    mechanism: word(params.get('mechanism')),
    maxCost: num(params.get('cost')),
    machine: word(params.get('machine'))
  };
}

/** Writes filters back to a query string, leaving out "any". */
export function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.grade !== null) p.set('grade', String(f.grade));
  if (f.mechanism !== null) p.set('mechanism', f.mechanism);
  if (f.maxCost !== null) p.set('cost', String(f.maxCost));
  if (f.machine !== null) p.set('machine', f.machine);
  const s = p.toString();
  return s ? `?${s}` : '';
}
