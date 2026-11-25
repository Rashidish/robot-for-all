// The daily job (M5 step 4e part 2).
import { beforeEach, describe, expect, it } from 'vitest';
import { encryptName, loadKeys, toBytea } from './crypto';
import { runDaily } from './daily';
import type { Env } from './handler';
import type { Mailer } from './mail';

const env: Env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_KEY: 'service',
  NAME_KEYS: JSON.stringify({ 1: Buffer.alloc(32, 5).toString('base64') }),
  NAME_KEY_CURRENT: '1',
  SITE_URL: 'https://robotsforall.org.za',
  ADMIN_URL: 'https://admin.robotsforall.org.za',
  PRIVACY_NOTICE_EMAIL: 'io@robotsforall.org.za'
};
const HASH = 'd'.repeat(64);
const TOKEN = 'e'.repeat(64);

let calls: string[];
let replies: Record<string, unknown>;
let mail: { to: string; subject: string; text: string }[];
const mailer: Mailer = {
  send: async (to, subject, text) => {
    mail.push({ to, subject, text });
    return true;
  }
};
const fakeFetch = (async (input: RequestInfo | URL) => {
  const fn = /\/rpc\/(\w+)$/.exec(String(input))?.[1] ?? '';
  calls.push(fn);
  return Response.json(fn in replies ? replies[fn] : null);
}) as typeof fetch;

beforeEach(async () => {
  calls = [];
  mail = [];
  const key = (await loadKeys(env.NAME_KEYS)).get(1);
  if (!key) throw new Error('no key');
  replies = {
    expire_pending_enrolments: 2,
    pending_reminders_due: [
      {
        id: 'p1',
        class_id: 'c1',
        confirm_token_hash: HASH,
        confirm_token_sealed: toBytea(await encryptName(key, `token:${HASH}`, TOKEN)),
        confirm_token_key_version: 1,
        parent_contact: toBytea(await encryptName(key, `contact:${HASH}`, 'mom@example.org')),
        parent_contact_key_version: 1
      }
    ],
    class_label: [{ class_name: 'Grade 4B', organisation_name: 'Sizwe Primary', language: 'zu' }],
    dormancy_warnings_due: [{ user_id: 'u1', months: 10, email: 'dad@example.org' }],
    mark_due_for_deletion: 1,
    lock_unconfirmed_deletions: 0,
    delete_after_lock: 3,
    deletion_counts: [{ due: 4, waiting_over_7_days: 2, locked: 1 }],
    job_due: true
  };
});

describe('the daily job', () => {
  it('without email: still expires requests and runs every deletion step; sends nothing', async () => {
    const r = await runDaily(env, { fetch: fakeFetch, now: Date.now, mailer: null });
    expect(r).toEqual({
      expired: 2,
      reminders: 0,
      warnings: 0,
      markedDue: 1,
      locked: 0,
      deleted: 3,
      noticeSent: false,
      emailSetUp: false,
      badges: 0
    });
    expect(calls).not.toContain('pending_reminders_due');
    expect(calls).not.toContain('dormancy_warnings_due');
  });

  it('with email: reminds with the same link, warns, and tells the back office (counts only)', async () => {
    const r = await runDaily(env, { fetch: fakeFetch, now: Date.now, mailer });
    expect(r).toMatchObject({ reminders: 1, warnings: 1, noticeSent: true, emailSetUp: true });
    const [reminder, warning, notice] = mail;
    expect(reminder?.to).toBe('mom@example.org');
    expect(reminder?.text).toContain(`https://robotsforall.org.za/enrol/confirm/#${TOKEN}`);
    expect(reminder?.subject).toMatch(/Isikhumbuzo/); // the class's language
    expect(warning?.to).toBe('dad@example.org');
    expect(warning?.text).toContain('10 months');
    expect(warning?.text).toContain('https://robotsforall.org.za/account/');
    expect(notice?.to).toBe('io@robotsforall.org.za');
    expect(notice?.text).toContain('Accounts due for deletion: 4 (2 waiting more than 7 days)');
    expect(notice?.text).toContain('https://admin.robotsforall.org.za/privacy/');
    expect(calls).toContain('pending_reminder_sent');
    expect(calls).toContain('dormancy_notice_sent');
  });

  it('does not email the back office again within 7 days, or when nothing waits', async () => {
    replies['job_due'] = false;
    expect((await runDaily(env, { fetch: fakeFetch, now: Date.now, mailer })).noticeSent).toBe(
      false
    );
    replies['job_due'] = true;
    replies['deletion_counts'] = [{ due: 0, waiting_over_7_days: 0, locked: 0 }];
    mail = [];
    expect((await runDaily(env, { fetch: fakeFetch, now: Date.now, mailer })).noticeSent).toBe(
      false
    );
    expect(mail.some((m) => m.to === env.PRIVACY_NOTICE_EMAIL)).toBe(false);
  });
});
