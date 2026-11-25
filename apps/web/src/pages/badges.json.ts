// What the badge rules need (M5 step 7): the live badges and their rules, the lessons they count
// (id, phase, mechanism) and each answer sheet's number of boxes. The certificate service reads
// this to award badges (7b), so it awards only what the site shows.
import type { APIRoute } from 'astro';
import { liveBadges } from '../lessons/badges';
import { getLessons, showDrafts } from '../lessons/load';
import { sheetBoxes, type SheetSummary } from '../lessons/answers';
import past from '../../../../content/sheets/codes.json';

export const GET: APIRoute = async () => {
  const lessons = await getLessons();
  const boxes = Object.fromEntries(
    Object.entries(past as Record<string, SheetSummary>).map(([code, s]) => [code, sheetBoxes(s)])
  );
  return new Response(
    JSON.stringify({
      badges: liveBadges(showDrafts).map((b) => ({ id: b.id, rule: b.rule })),
      lessons: lessons.map((l) => ({ id: l.id, phase: l.data.phase, mechanism: l.data.mechanism })),
      boxes
    }),
    { headers: { 'content-type': 'application/json' } }
  );
};
