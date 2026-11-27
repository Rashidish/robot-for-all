// The helper's daily job (Cron Trigger, M6 spec FR-15 to FR-18, FR-21, §6):
//   1. per-person usage older than 31 days is deleted (always, even when the helper is off);
//   2. the back office is emailed once when the month reaches 80% and once at 100% of the question
//      cap or budget (counts only), once an email provider is set up;
//   3. Common questions are drafted for lessons that have none, whose text changed, whose prompt
//      version changed or that have a hidden answer, up to MAX_DRAFTS a day, while the helper is on
//      and the month's budget lasts. Each is checked; only counts and costs are recorded.
import { mailerFrom, type Mailer, words } from '../../cert/src/mail.ts';
import { draftFaq } from './faq.ts';
import { type Deps, type Env, lessonContext, lessonFor, rpc } from './handler.ts';
import { anthropicProvider } from './providers/anthropic.ts';
import { ALLOWED, costCents, modelFor } from './providers/models.ts';
import { promptFor } from './prompts.ts';

export const MAX_DRAFTS = 10;

export interface DailyEnv extends Env {
  EMAIL_PROVIDER?: string;
  /** Where budget notices go (the owner's address); a Worker secret. */
  HELPER_NOTICE_EMAIL?: string;
  ADMIN_URL?: string;
}

interface DailyDeps extends Deps {
  mailer?: Mailer | null;
}

export interface DailyReport {
  cleaned: number;
  notice: '80' | '100' | null;
  drafted: number;
  dropped: number;
  skipped: string | null;
}

interface Config {
  enabled: boolean;
  faq_model: string;
  faq_prompt: string;
}
interface MonthStatus {
  questions: number;
  spend_cents: number;
  month_questions: number;
  month_budget_cents: number;
}
interface FaqState {
  lesson_id: string;
  language: string;
  lesson_hash: string;
  prompt_version: string;
  hidden: number;
}

export async function runDaily(env: DailyEnv, deps: DailyDeps): Promise<DailyReport> {
  const report: DailyReport = { cleaned: 0, notice: null, drafted: 0, dropped: 0, skipped: null };
  report.cleaned = Number((await rpc<number>(env, deps, 'helper_cleanup', {})) ?? 0);

  const config = await rpc<Config>(env, deps, 'helper_config', {});
  const status = (await rpc<MonthStatus[]>(env, deps, 'helper_month_status', {}))?.[0];
  if (!config || !status) return { ...report, skipped: 'database' };

  // 80% and 100% notices, each once a month.
  const share = Math.max(
    status.month_questions ? status.questions / status.month_questions : 0,
    status.month_budget_cents ? status.spend_cents / status.month_budget_cents : 0
  );
  const mailer = deps.mailer === undefined ? mailerFrom(env) : deps.mailer;
  const level = share >= 1 ? '100' : share >= 0.8 ? '80' : null;
  if (level && mailer && env.HELPER_NOTICE_EMAIL) {
    const month = new Date(deps.now()).toISOString().slice(0, 7);
    const due = await rpc<boolean>(env, deps, 'job_due', {
      p_name: `helper_budget_${level}_${month}`,
      p_every: '40 days'
    });
    if (due) {
      const values = {
        percent: level,
        questions: String(status.questions),
        cap: String(status.month_questions),
        spend: (status.spend_cents / 100).toFixed(2),
        budget: (status.month_budget_cents / 100).toFixed(2),
        link: `${env.ADMIN_URL ?? 'https://admin.robotsforall.org.za'}/helper/`
      };
      const sent = await mailer
        .send(
          env.HELPER_NOTICE_EMAIL,
          words('en', 'email_helper_budget_subject', values),
          words('en', 'email_helper_budget_body', values)
        )
        .catch(() => false);
      if (sent) report.notice = level;
    }
  }

  if (!config.enabled) return { ...report, skipped: 'off' };
  if (status.spend_cents >= status.month_budget_cents) return { ...report, skipped: 'budget' };

  const site = env.SITE_URL ?? 'https://robotsforall.org.za';
  const indexRes = await deps.fetch(`${site}/helper-lessons.json`);
  if (!indexRes.ok) return { ...report, skipped: 'site' };
  const index = (await indexRes.json()) as {
    languages: string[];
    lessons: { id: string; hash: string }[];
  };
  const state = (await rpc<FaqState[]>(env, deps, 'helper_faq_state', {})) ?? [];
  const known = new Map(state.map((s) => [`${s.lesson_id}/${s.language}`, s]));
  const model = modelFor(config.faq_model, 'faq');
  const system = promptFor(config.faq_prompt, 'faq');
  const provider = deps.provider
    ? deps.provider(model)
    : anthropicProvider(env.ANTHROPIC_API_KEY ?? '');

  const todo = index.lessons.flatMap((l) =>
    index.languages
      .filter((lang) => {
        const s = known.get(`${l.id}/${lang}`);
        return (
          !s || s.lesson_hash !== l.hash || s.prompt_version !== config.faq_prompt || s.hidden > 0
        );
      })
      .map((lang) => ({ id: l.id, hash: l.hash, lang }))
  );
  for (const job of todo.slice(0, MAX_DRAFTS)) {
    const lesson = await lessonFor(job.id, env, deps);
    if (!lesson) continue;
    let draft;
    try {
      draft = await draftFaq({
        provider,
        model,
        system,
        context: lessonContext(lesson),
        language: job.lang,
        youngestGrade: Math.min(...lesson.grades)
      });
    } catch {
      continue;
    }
    const cents = ALLOWED[model]
      ? costCents(model, draft.usage, Number(env.ZAR_PER_USD ?? '18'))
      : 0;
    await rpc(env, deps, 'helper_record', {
      p_subject: null,
      p_audience: 'faq',
      p_refused: draft.refused,
      p_blocked: draft.dropped > 0,
      p_cost_cents: cents
    });
    report.dropped += draft.dropped;
    if (draft.items.length < 3) continue;
    await rpc(env, deps, 'helper_faq_store', {
      p_lesson: job.id,
      p_language: job.lang,
      p_items: draft.items,
      p_model: model,
      p_prompt: config.faq_prompt,
      p_hash: job.hash
    });
    report.drafted += 1;
  }
  return report;
}
