// A lesson as the AI helper reads it (M6 spec FR-12, FR-18): the words already on its page, and a
// hash of them so the helper's daily job redrafts a lesson's Common questions when it changes.
import { createHash } from 'node:crypto';
import type { LessonEntry } from './load';

export interface HelperLesson {
  id: string;
  title: string;
  phase: number;
  grades: number[];
  mechanism: string;
  hardware: string;
  parts: { item: string; qty: number; substitute?: string | undefined }[];
  outcomes: string[];
  concepts: string[];
  safety: { adult_help: boolean; notes: string[] };
  body: string;
  hash: string;
}

export function helperLesson(lesson: LessonEntry): HelperLesson {
  const d = lesson.data;
  const content = {
    id: lesson.id,
    title: d.title,
    phase: d.phase,
    grades: d.grades,
    mechanism: d.mechanism,
    hardware: d.hardware,
    parts: d.parts,
    outcomes: d.outcomes,
    concepts: d.concepts,
    safety: d.safety,
    body: lesson.body ?? ''
  };
  const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16);
  return { ...content, hash };
}
