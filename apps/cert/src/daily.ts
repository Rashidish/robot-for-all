// The daily job (M5 spec v0.5 §7.5, FR-5a), run by a Cron Trigger on this Worker:
//   1. waiting school enrolments: expired ones deleted (14 days); reminders on days 5 and 10;
//   2. dormancy warnings by email at 10 and 11 months without signing in;
//   3. deletion: due at 12 months; locked 30 days later if nobody confirmed; deleted when the
//      lock ends (migration 0015);
//   4. the back office is emailed every 7 days while accounts wait or are locked;
//   5. badges: learners with new or newly checked records are checked against the badge rules
//      (step 7b), in case their phone didn't ask straight away;
//   6. name key rotation: values still locked with an older key are locked again with the
//      current one (rekey.ts, migration 0027).
// Steps 1, 3 never need email; 2 and 4 run once a provider is set up. Nothing personal is
// returned or logged: only counts.
import { checkLearner } from './badges';
import { decryptName, fromBytea, loadKeys } from './crypto';
import { type Deps, type Env, rpc } from './handler';
import { mailerFrom, words } from './mail';
import { rekeyNames } from './rekey';

export interface DailyReport {
  expired: number;
  reminders: number;
  warnings: number;
  markedDue: number;
  locked: number;
  deleted: number;
  noticeSent: boolean;
  emailSetUp: boolean;
  badges: number;
  rekeyed: number;
  unreadable: number;
}

interface ReminderRow {
  id: string;
  class_id: string;
  confirm_token_hash: string;
  confirm_token_sealed: string;
  confirm_token_key_version: number;
  parent_contact: string;
  parent_contact_key_version: number;
}

const count = async (env: Env, deps: Deps, fn: string) => {
  const r = await rpc<number>(env, deps, fn, {});
  return r.ok ? Number(r.body) : 0;
};

export async function runDaily(env: Env, deps: Deps): Promise<DailyReport> {
  const mailer = deps.mailer === undefined ? mailerFrom(env) : deps.mailer;
  const site = env.SITE_URL ?? 'https://robotsforall.org.za';
  const keys = await loadKeys(env.NAME_KEYS);
  const report: DailyReport = {
    expired: await count(env, deps, 'expire_pending_enrolments'),
    reminders: 0,
    warnings: 0,
    markedDue: 0,
    locked: 0,
    deleted: 0,
    noticeSent: false,
    emailSetUp: mailer !== null,
    badges: 0,
    rekeyed: 0,
    unreadable: 0
  };

  if (mailer) {
    // Reminders: the same link, in the class's language, still without the child's name.
    const due = await rpc<ReminderRow[]>(env, deps, 'pending_reminders_due', {});
    for (const p of (due.ok ? due.body : null) ?? []) {
      const key = keys.get(p.confirm_token_key_version);
      const contactKey = keys.get(p.parent_contact_key_version);
      if (!key || !contactKey) continue;
      const unlocked = await Promise.all([
        decryptName(key, `token:${p.confirm_token_hash}`, fromBytea(p.confirm_token_sealed)),
        decryptName(contactKey, `contact:${p.confirm_token_hash}`, fromBytea(p.parent_contact))
      ]).catch(() => null);
      if (!unlocked) continue;
      const [token, to] = unlocked;
      const label = await rpc<
        { class_name: string; organisation_name: string; language: string }[]
      >(env, deps, 'class_label', { p_class: p.class_id });
      const where = label.ok ? label.body[0] : undefined;
      if (!where) continue;
      const values = {
        organisation: where.organisation_name,
        class: where.class_name,
        link: `${site}/enrol/confirm/#${token}`
      };
      const ok = await mailer
        .send(
          to,
          words(where.language, 'email_enrol_reminder_subject', values),
          words(where.language, 'email_enrol_body', values)
        )
        .catch(() => false);
      if (ok) {
        await rpc(env, deps, 'pending_reminder_sent', { p_id: p.id });
        report.reminders += 1;
      }
    }

    // Dormancy warnings, to the adult's own sign-in address.
    const warn = await rpc<{ user_id: string; months: number; email: string }[]>(
      env,
      deps,
      'dormancy_warnings_due',
      {}
    );
    for (const a of (warn.ok ? warn.body : null) ?? []) {
      const values = { months: String(a.months), link: `${site}/account/` };
      const ok = await mailer
        .send(
          a.email,
          words('en', 'email_dormant_subject', values),
          words('en', 'email_dormant_body', values)
        )
        .catch(() => false);
      if (ok) {
        await rpc(env, deps, 'dormancy_notice_sent', { p_user: a.user_id });
        report.warnings += 1;
      }
    }
  }

  report.markedDue = await count(env, deps, 'mark_due_for_deletion');
  report.locked = await count(env, deps, 'lock_unconfirmed_deletions');
  report.deleted = await count(env, deps, 'delete_after_lock');

  // Every 7 days while anything waits or is locked: tell the back office (counts only).
  if (mailer && env.PRIVACY_NOTICE_EMAIL) {
    const c = await rpc<{ due: number; waiting_over_7_days: number; locked: number }[]>(
      env,
      deps,
      'deletion_counts',
      {}
    );
    const n = c.ok ? c.body[0] : undefined;
    if (n && n.due + n.locked > 0) {
      const runNow = await rpc<boolean>(env, deps, 'job_due', {
        p_name: 'privacy_notice',
        p_every: '7 days'
      });
      if (runNow.ok && runNow.body) {
        const values = {
          due: String(n.due),
          overdue: String(n.waiting_over_7_days),
          locked: String(n.locked),
          link: `${env.ADMIN_URL ?? 'https://admin.robotsforall.org.za'}/privacy/`
        };
        report.noticeSent = await mailer
          .send(
            env.PRIVACY_NOTICE_EMAIL,
            words('en', 'email_privacy_notice_subject', values),
            words('en', 'email_privacy_notice_body', values)
          )
          .catch(() => false);
      }
    }
  }
  const recent = await rpc<{ learner_id: string }[]>(env, deps, 'learners_with_new_records', {
    p_since: '25 hours'
  });
  for (const r of recent.ok && recent.body ? recent.body : []) {
    report.badges += (await checkLearner(r.learner_id, env, deps, mailer)).length;
  }
  Object.assign(report, await rekeyNames(env, deps, keys));
  return report;
}
