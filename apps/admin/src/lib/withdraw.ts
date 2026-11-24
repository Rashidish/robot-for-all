// Withdraw / restore (more content spec §2.4): one item added to or removed from
// content/site/withdrawn.json, as one pull request plus a record in the database. If the database
// refuses (role, reason), the pull request is closed again.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildWithdrawn,
  ID_PATTERNS,
  type WithdrawnItem,
  type WithdrawnList,
  withdrawnText,
  type WithdrawType,
  withItem,
  withoutItem
} from '../../../../packages/settings/src/withdrawn';
import type { GitHub } from './github';
import { WITHDRAWN_PATH } from './merge';
import { readLessons } from './review';

export const TYPE_LABELS: Record<WithdrawType, string> = {
  lesson: 'Lesson',
  template: 'Template',
  world: 'World or course',
  season: 'Season',
  language: 'Language'
};

export interface LiveItem {
  type: WithdrawType;
  id: string;
  label: string;
}

export async function readWithdrawn(gh: GitHub): Promise<{ list: WithdrawnList; sha: string }> {
  const file = await gh.readFile(WITHDRAWN_PATH);
  return { list: buildWithdrawn(JSON.parse(file.text)), sha: file.sha };
}

/** Everything live that could be withdrawn: published lessons and their templates, worlds, seasons. */
export async function liveItems(gh: GitHub, list: WithdrawnList): Promise<LiveItem[]> {
  const [lessons, worlds, seasons] = await Promise.all([
    readLessons(gh),
    gh.listDir('content/worlds'),
    gh.listDir('content/seasons')
  ]);
  const out: LiveItem[] = [];
  for (const l of lessons.filter((x) => x.status === 'published')) {
    out.push({ type: 'lesson', id: l.id, label: `${l.title} (${l.id})` });
    for (const t of l.templates)
      out.push({ type: 'template', id: `${l.id}/${t}`, label: `${l.title}: ${t}` });
  }
  for (const f of worlds.filter((x) => x.name.endsWith('.json'))) {
    const id = f.name.replace(/\.json$/, '');
    out.push({ type: 'world', id, label: id });
  }
  for (const f of seasons.filter((x) => x.name.endsWith('.json'))) {
    const id = f.name.replace(/\.json$/, '');
    out.push({ type: 'season', id, label: id });
  }
  const off = new Set(list.items.map((i) => `${i.type}:${i.id}`));
  return out.filter((i) => !off.has(`${i.type}:${i.id}`));
}

export async function changeWithdrawn(
  gh: GitHub,
  supabase: SupabaseClient,
  input: {
    action: 'withdraw' | 'restore';
    type: WithdrawType;
    id: string;
    reason: string;
    who: string;
    now?: Date;
  }
): Promise<string> {
  if (!ID_PATTERNS[input.type].test(input.id)) throw new Error('That is not a valid item.');
  const reason = input.reason.trim();
  if (reason.length < 10) throw new Error('Write a reason of at least 10 characters.');
  const now = input.now ?? new Date();
  const { list, sha } = await readWithdrawn(gh);
  const already = list.items.some((i) => i.type === input.type && i.id === input.id);
  if (input.action === 'withdraw' && already) throw new Error('That is already withdrawn.');
  if (input.action === 'restore' && !already) throw new Error('That is not withdrawn.');
  const item: WithdrawnItem = {
    type: input.type,
    id: input.id,
    reason,
    since: new Date(now.getTime() + 2 * 3600_000).toISOString().slice(0, 10)
  };
  const next =
    input.action === 'withdraw' ? withItem(list, item) : withoutItem(list, input.type, input.id);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const branch = `admin/${input.action}-${input.type}-${input.id.replace('/', '--')}-${stamp}`;
  const verb = input.action === 'withdraw' ? 'Withdraw' : 'Restore';
  const title = `${verb} ${TYPE_LABELS[input.type].toLowerCase()} ${input.id}`;
  const url = await gh.proposeChange({
    branch,
    path: WITHDRAWN_PATH,
    text: withdrawnText(next),
    sha,
    message: `${title} (back office)`,
    title,
    body: `${verb} by ${input.who}: ${reason}\n\nOnly one item of the withdrawn list changes. The back office merges this after CI passes (ADR-0012).`
  });
  const number = gh.lastPullNumber;
  const { error } = await supabase.rpc('record_withdrawal', {
    p_type: input.type,
    p_id: input.id,
    p_decision: input.action === 'withdraw' ? 'withdrawn' : 'restored',
    p_reason: reason,
    p_pull_request: url
  });
  if (error) {
    await gh.closePull(number, branch).catch(() => undefined);
    throw new Error(error.message);
  }
  return url;
}
