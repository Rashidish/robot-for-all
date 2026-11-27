// A lesson as the AI helper reads it (M6 spec FR-12, §6): the words already on the lesson page
// (English source: title, grades, parts, safety, outcomes, concepts, body with teacher notes) and
// their hash. Fetched only by the helper service on our own domain; not precached, never linked.
// Withdrawn lessons are left out of production like their pages.
import type { APIRoute, GetStaticPaths } from 'astro';
import { helperLesson } from '../../lessons/helper';
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
  return new Response(JSON.stringify(helperLesson(lesson)), {
    headers: { 'content-type': 'application/json' }
  });
};
