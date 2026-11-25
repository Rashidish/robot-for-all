// Awarding badges automatically (M5 FR-19a, step 7b). The rules live in packages/badges; the
// live badges, lessons and sheet totals come from the site's /badges.json, so only what the site
// shows is awarded. A badge is awarded once (award_badge ignores repeats; a revoked one stays
// revoked), and each parent is emailed "<nickname> earned <badge>", never the certificate name.
import {
  earns,
  type LessonFacts,
  type LessonResult,
  type Rule
} from '../../../packages/badges/src/badge';
import { type Deps, type Env, rpc } from './handler';
import { type Mailer, words } from './mail';

interface BadgeIndex {
  badges: { id: string; rule: Rule }[];
  lessons: LessonFacts[];
  boxes: Record<string, number>;
}
interface BadgeRecord {
  lesson_id: string;
  sheet_code: string;
  steps_done: number;
  i_can: boolean[];
  built_working: boolean;
  recorded_at: string;
}

let cached: { at: number; index: BadgeIndex } | null = null;

/** The site's badge index, kept for 10 minutes. */
export async function badgeIndex(env: Env, deps: Deps): Promise<BadgeIndex | null> {
  if (cached && deps.now() - cached.at < 10 * 60_000) return cached.index;
  try {
    const res = await deps.fetch(`${env.SITE_URL ?? 'https://robotsforall.org.za'}/badges.json`);
    if (!res.ok) return null;
    cached = { at: deps.now(), index: (await res.json()) as BadgeIndex };
    return cached.index;
  } catch {
    return null;
  }
}
export const forgetBadgeIndex = () => {
  cached = null;
};

/** Each lesson's result from its newest counting record. */
export function lessonResults(
  records: BadgeRecord[],
  boxes: Record<string, number>
): LessonResult[] {
  const newest = new Map<string, BadgeRecord>();
  for (const r of [...records].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))) {
    if (!newest.has(r.lesson_id)) newest.set(r.lesson_id, r);
  }
  return [...newest.values()].map((r) => {
    const allYes = r.i_can.length > 0 && r.i_can.every(Boolean);
    const total = boxes[r.sheet_code];
    return {
      lesson: r.lesson_id,
      allYes,
      done: allYes && r.built_working && total !== undefined && r.steps_done >= total
    };
  });
}

const ruleVersion = async (rule: Rule) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rule)))
    ).slice(0, 4),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');

/** Awards every badge this learner has newly earned; emails their parents. Returns the new ones. */
export async function checkLearner(
  learner: string,
  env: Env,
  deps: Deps,
  mailer: Mailer | null
): Promise<string[]> {
  const index = await badgeIndex(env, deps);
  if (!index) return [];
  const records = await rpc<BadgeRecord[]>(env, deps, 'badge_records', { p_learner: learner });
  if (!records.ok) return [];
  const results = lessonResults(records.body, index.boxes);
  const awarded: string[] = [];
  for (const badge of index.badges) {
    if (!earns(badge.rule, results, index.lessons)) continue;
    const made = await rpc<string | null>(env, deps, 'award_badge', {
      p_learner: learner,
      p_badge: badge.id,
      p_rule_version: await ruleVersion(badge.rule)
    });
    if (made.ok && made.body) awarded.push(badge.id);
  }
  if (awarded.length > 0 && mailer) {
    const parents = await rpc<{ email: string; nickname: string; language: string }[]>(
      env,
      deps,
      'learner_guardian_emails',
      { p_learner: learner }
    );
    for (const p of parents.ok ? parents.body : []) {
      const names = awarded
        .map((id) => words(p.language, `badge_${id.replace(/-/g, '_')}_name`, {}))
        .join(', ');
      const values = {
        nickname: p.nickname,
        badges: names,
        link: `${env.SITE_URL ?? 'https://robotsforall.org.za'}/account/`
      };
      await mailer
        .send(
          p.email,
          words(p.language, 'email_badge_subject', values),
          words(p.language, 'email_badge_body', values)
        )
        .catch(() => false);
    }
  }
  return awarded;
}
