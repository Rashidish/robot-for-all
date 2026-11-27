// The lessons whose Common questions the AI helper's daily job keeps drafted (M6 spec FR-15,
// FR-18): each live lesson's id and hash, and the site's languages. Read only by the helper.
import type { APIRoute } from 'astro';
import { helperLesson } from '../lessons/helper';
import { getLessons } from '../lessons/load';
import { siteLanguages } from '../site-languages';
import { hidden } from '../withdrawn';

export const GET: APIRoute = async () => {
  const lessons = (await getLessons()).filter((l) => !hidden('lesson', l.id));
  return new Response(
    JSON.stringify({
      languages: siteLanguages.map((l) => l.code),
      lessons: lessons.map((l) => ({ id: l.id, hash: helperLesson(l).hash }))
    }),
    { headers: { 'content-type': 'application/json' } }
  );
};
