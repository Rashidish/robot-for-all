// The printable template file itself (true-scale A4 SVG), built at build time.
import type { APIRoute } from 'astro';
import { getLessons } from '../../../lessons/load';
import { findTemplate, templateSvg } from '../../../templates/load';

export async function getStaticPaths() {
  const lessons = await getLessons();
  return lessons.flatMap((lesson) =>
    lesson.data.templates.map((name) => ({ params: { lesson: lesson.id, name } }))
  );
}

export const GET: APIRoute = ({ params }) => {
  const entry = findTemplate(params['lesson'] ?? '', params['name'] ?? '');
  if (!entry) return new Response('Not found', { status: 404 });
  return new Response(templateSvg(entry), {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' }
  });
};
