// Each live badge's artwork at /badges/<id>.svg (served from our own domain).
import type { APIRoute } from 'astro';
import { badgeArt, liveBadges } from '../../lessons/badges';
import { showDrafts } from '../../lessons/load';

export function getStaticPaths() {
  return liveBadges(showDrafts).map((b) => ({ params: { id: b.id } }));
}

export const GET: APIRoute = ({ params }) =>
  new Response(badgeArt(String(params['id'])) ?? '', {
    headers: { 'content-type': 'image/svg+xml' }
  });
