// Withdrawn content (docs/specs/back-office-more-content.md §2.4): content/site/withdrawn.json
// lists live items taken down, unchanged, with a reason. Production leaves them out; the back
// office adds and removes one item at a time. One check for the public build and the back office.
import { prettyJson } from './json';

export const WITHDRAW_TYPES = [
  'lesson',
  'template',
  'world',
  'season',
  'language',
  'machine'
] as const;
export type WithdrawType = (typeof WITHDRAW_TYPES)[number];

export interface WithdrawnItem {
  type: WithdrawType;
  /** lesson id, "<lesson>/<sheet>" for a template, world id, season id, language code or Machines topic id. */
  id: string;
  reason: string;
  /** YYYY-MM-DD, South African date. */
  since: string;
}

export interface WithdrawnList {
  items: WithdrawnItem[];
}

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
export const ID_PATTERNS: Record<WithdrawType, RegExp> = {
  lesson: new RegExp(`^${SLUG}$`),
  template: new RegExp(`^${SLUG}/${SLUG}$`),
  world: new RegExp(`^${SLUG}$`),
  season: new RegExp(`^${SLUG}$`),
  language: /^[a-z]{2,3}$/,
  machine: /^[a-z]+(?:-[a-z]+)*$/
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export function checkWithdrawn(spec: unknown): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  if (!isObject(spec) || !Array.isArray(spec['items'])) {
    return [{ path: '$', message: 'must be { "items": [...] }' }];
  }
  for (const k of Object.keys(spec))
    if (k !== 'items') out.push({ path: `$.${k}`, message: 'is not a field' });
  const seen = new Set<string>();
  spec['items'].forEach((item: unknown, i) => {
    const path = `$.items[${i}]`;
    if (!isObject(item)) {
      out.push({ path, message: 'must be an object' });
      return;
    }
    for (const k of Object.keys(item))
      if (!['type', 'id', 'reason', 'since'].includes(k))
        out.push({ path: `${path}.${k}`, message: 'is not a field' });
    const type = item['type'];
    if (!(WITHDRAW_TYPES as readonly unknown[]).includes(type)) {
      out.push({ path: `${path}.type`, message: `must be one of ${WITHDRAW_TYPES.join(', ')}` });
      return;
    }
    const id = item['id'];
    if (typeof id !== 'string' || !ID_PATTERNS[type as WithdrawType].test(id))
      out.push({ path: `${path}.id`, message: `is not a valid ${String(type)} id` });
    const reason = item['reason'];
    if (typeof reason !== 'string' || reason.trim().length < 10 || /[<>]/.test(reason))
      out.push({
        path: `${path}.reason`,
        message: 'must explain why, in at least 10 characters (no < or >)'
      });
    const since = item['since'];
    if (
      typeof since !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(since) ||
      Number.isNaN(Date.parse(since))
    )
      out.push({ path: `${path}.since`, message: 'must be a date like 2026-11-24' });
    const key = `${String(type)}:${String(id)}`;
    if (seen.has(key)) out.push({ path, message: `${key} is listed twice` });
    seen.add(key);
  });
  return out;
}

export function buildWithdrawn(spec: unknown): WithdrawnList {
  const problems = checkWithdrawn(spec);
  if (problems.length > 0)
    throw new Error(
      problems.map((p) => `content/site/withdrawn.json ${p.path}: ${p.message}`).join('\n')
    );
  return spec as WithdrawnList;
}

/** Is this item withdrawn? A template is also withdrawn when its lesson is. */
export function isWithdrawn(list: WithdrawnList, type: WithdrawType, id: string): boolean {
  const has = (t: WithdrawType, i: string) => list.items.some((x) => x.type === t && x.id === i);
  if (has(type, id)) return true;
  if (type === 'template') return has('lesson', id.split('/')[0] ?? '');
  return false;
}

/** The list with one item added (or replaced, if already there). */
export function withItem(list: WithdrawnList, item: WithdrawnItem): WithdrawnList {
  return {
    items: [...list.items.filter((x) => !(x.type === item.type && x.id === item.id)), item].sort(
      (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)
    )
  };
}

/** The list with one item removed. */
export function withoutItem(list: WithdrawnList, type: WithdrawType, id: string): WithdrawnList {
  return { items: list.items.filter((x) => !(x.type === type && x.id === id)) };
}

/** The file text, formatted as the repository keeps it. */
export const withdrawnText = (list: WithdrawnList): string => prettyJson(list);

/**
 * True when two versions of the list differ by exactly one item added or removed (ADR-0012
 * condition 2 for the withdrawn list): the back office may merge such a change after CI.
 */
export function oneItemChanged(before: unknown, after: unknown): boolean {
  if (checkWithdrawn(before).length > 0 || checkWithdrawn(after).length > 0) return false;
  const key = (x: WithdrawnItem) => JSON.stringify([x.type, x.id, x.reason, x.since]);
  const a = new Set((before as WithdrawnList).items.map(key));
  const b = new Set((after as WithdrawnList).items.map(key));
  const added = [...b].filter((k) => !a.has(k));
  const removed = [...a].filter((k) => !b.has(k));
  return added.length + removed.length === 1;
}
