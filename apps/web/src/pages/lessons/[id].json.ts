// A lesson as the AI helper reads it (M6 spec FR-12, §6): the words already on the lesson page
// (English source: title, grades, parts, safety, outcomes, concepts, body with teacher notes).
// Fetched only by the helper service on our own domain; not precached, never linked from a page.
// Withdrawn lessons are left out of production like their pages.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getLessons, type LessonEntry } from '../../lessons/load';
import { hidden } from '../../withdrawn';

export const getStaticPaths: GetStaticPaths = async () => {
  const lessons = await getLessons();
  return lessons
    .filter((lesson) => !hidden('lesson', lesson.id))
    .map((lesson) => ({ params: { id: lesson.id }, props: { lesson } }));
};

export const GET: APIRoute = ({ props }) => {
  const { lesson } = props as { lesson: LessonEntry };
  const d = lesson.data;
  return new Response(
    JSON.stringify({
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
    }),
    { headers: { 'content-type': 'application/json' } }
  );
};
