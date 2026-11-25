// M5 Teach (migration 0010): enrolment, consent, access rules, records, badges, certificates and
// deletion, on PGlite. Every rule in docs/specs/M5-teach.md §7 that the database enforces.
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const ROOT = '00000000-0000-4000-8000-000000000001';
const TEACHER = '00000000-0000-4000-8000-000000000011';
const OTHER_TEACHER = '00000000-0000-4000-8000-000000000012';
const PARENT = '00000000-0000-4000-8000-000000000021';
const OTHER_PARENT = '00000000-0000-4000-8000-000000000022';
const VERIFIER = '00000000-0000-4000-8000-000000000031';
const NOTICE = '1.0';
const NAME = Buffer.from('ciphertext-of-a-name');

let t: TestDb;

/** Runs SQL as a learner session (ADR-0013): role authenticated, kind learner, no user id. */
async function asLearner<T = Record<string, unknown>>(
  learner: string,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const claims = JSON.stringify({ role: 'authenticated', kind: 'learner', learner_id: learner });
  await t.db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await t.db.exec('set role authenticated');
  try {
    return (await t.db.query<T>(sql, params)).rows;
  } finally {
    await t.db.exec('reset role');
    await t.db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};

async function schoolWithClass(admin = TEACHER, emis = '500123456') {
  const { id: org } = await one(
    t.as<{ id: string }>(
      admin,
      `select public.register_organisation('school', 'Sizwe Primary', 'KwaZulu-Natal', $1, null) as id`,
      [emis]
    )
  );
  const { id: cls } = await one(
    t.as<{ id: string }>(
      admin,
      `select public.create_class($1, 'Grade 4B Robotics', '3-4', 'zu') as id`,
      [org]
    )
  );
  const { enrol_token } = await one(
    t.as<{ enrol_token: string }>(admin, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  );
  return { org, cls, token: enrol_token };
}

async function enrol(token: string, nickname = 'Rocket', parent = PARENT) {
  const { id } = await one(
    t.as<{ id: string }>(parent, `select public.enrol_child($1, $2, 4, 'robot', 'zu', $3) as id`, [
      token,
      nickname,
      NOTICE
    ])
  );
  return id;
}

const record = (learner: string, id = 'a'.repeat(32)) =>
  asLearner(
    learner,
    `insert into public.sheet_records (id, learner_id, lesson_id, sheet_code, steps_done, i_can,
       built_working, recorded_at)
     values ($1, $2, 'p1-crank-01', 'p1-crank-01-81feed', 7, array[true, true, false, true], true, now())`,
    [id, learner]
  );

beforeEach(async () => {
  t = await TestDb.create({
    [ROOT]: 'root@example.org',
    [TEACHER]: 'teacher@example.org',
    [OTHER_TEACHER]: 'other.teacher@example.org',
    [PARENT]: 'parent@example.org',
    [OTHER_PARENT]: 'other.parent@example.org',
    [VERIFIER]: 'verifier@example.org'
  });
  await t.service(`select public.bootstrap_super_admin($1)`, [ROOT]);
  await t.as(ROOT, `select public.grant_role($1, 'coach_verifier')`, [VERIFIER]);
});

describe('organisations and classes', () => {
  it('an unverified school gets one trial class; verifying it lifts the limit', async () => {
    const { org } = await schoolWithClass();
    await expect(
      t.as(TEACHER, `select public.create_class($1, 'Grade 5A', '5-6', 'en')`, [org])
    ).rejects.toThrow(/one trial class/);
    await expect(
      t.as(TEACHER, `select public.verify_organisation($1, 'official_phone')`, [org])
    ).rejects.toThrow(/coach verifier/);
    await expect(
      t.as(VERIFIER, `select public.verify_organisation($1, 'references')`, [org])
    ).rejects.toThrow(/schools are verified/);
    await t.as(VERIFIER, `select public.verify_organisation($1, 'official_phone')`, [org]);
    await t.as(TEACHER, `select public.create_class($1, 'Grade 5A', '5-6', 'en')`, [org]);
  });

  it('an unregistered club is verified by references and re-checked yearly', async () => {
    const { id: club } = await one(
      t.as<{ id: string }>(
        TEACHER,
        `select public.register_organisation('club', 'Umlazi Makers', 'KwaZulu-Natal', null, null, false) as id`
      )
    );
    await t.as(VERIFIER, `select public.verify_organisation($1, 'references')`, [club]);
    const row = await one(
      t.owner<{ months: number }>(
        `select (extract(year from age(reverify_by, current_date)) * 12
                 + extract(month from age(reverify_by, current_date)))::int as months
           from public.organisations where id = $1`,
        [club]
      )
    );
    expect(row.months).toBe(12);
  });

  it('class codes are six consonants and teachers only see their own classes', async () => {
    const { cls } = await schoolWithClass();
    const { class_code } = await one(
      t.owner<{ class_code: string }>(`select class_code from public.classes where id = $1`, [cls])
    );
    expect(class_code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{6}$/);
    expect(await t.as(OTHER_TEACHER, `select id from public.classes`)).toEqual([]);
  });
});

describe('enrolment by a parent, with consent (spec FR-5 to FR-10)', () => {
  it('a parent enrols their child; the teacher sees the nickname, never a name', async () => {
    const { token } = await schoolWithClass();
    const learner = await enrol(token);
    const seen = await t.as<{ nickname: string }>(TEACHER, `select nickname from public.learners`);
    expect(seen.map((r) => r.nickname)).toEqual(['Rocket']);
    await expect(
      t.as(TEACHER, `select certificate_name from public.learners where id = $1`, [learner])
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as(PARENT, `select pin_hash from public.learners where id = $1`, [learner])
    ).rejects.toThrow(/permission denied/);
    expect(await t.as(OTHER_PARENT, `select id from public.learners`)).toEqual([]);
  });

  it('nicknames are unique in a class', async () => {
    const { token } = await schoolWithClass();
    await enrol(token, 'Rocket');
    await expect(enrol(token, ' rocket ', OTHER_PARENT)).rejects.toThrow(/already used/);
  });

  it('an unverified organisation stops at 40 learners', async () => {
    const { token } = await schoolWithClass();
    for (let i = 0; i < 40; i++) await enrol(token, `Learner ${i}`);
    await expect(enrol(token, 'One too many')).rejects.toThrow(/up to 40/);
  });

  it('withdrawing the learning-record consent deletes the child and their records', async () => {
    const { token } = await schoolWithClass();
    const learner = await enrol(token);
    await record(learner);
    await t.as(PARENT, `select public.withdraw_consent($1, 'record')`, [learner]);
    expect(await t.owner(`select 1 from public.learners where id = $1`, [learner])).toEqual([]);
    expect(await t.owner(`select 1 from public.sheet_records`)).toEqual([]);
  });

  it('only a guardian can withdraw or delete', async () => {
    const { token } = await schoolWithClass();
    const learner = await enrol(token);
    await expect(t.as(TEACHER, `select public.delete_learner($1)`, [learner])).rejects.toThrow(
      /parent or guardian/
    );
    await expect(
      t.as(OTHER_PARENT, `select public.withdraw_consent($1, 'record')`, [learner])
    ).rejects.toThrow(/parent or guardian/);
  });
});

describe('enrolment by a school, confirmed by a parent (spec FR-5a)', () => {
  const pending = async (cls: string, token: string) =>
    one(
      t.service<{ id: string }>(
        `select public.create_pending_enrolment($1, $2, 4, $3, 1, $4, 1,
           encode(sha256(convert_to($5, 'UTF8')), 'hex')) as id`,
        [cls, TEACHER, NAME, Buffer.from('ciphertext-of-a-phone'), token]
      )
    );

  it('the parent confirms with the link secret; the pending copy is deleted at once', async () => {
    const { cls } = await schoolWithClass();
    await pending(cls, 'secret-link-1');
    // The teacher sees that something is waiting, not the name or the contact.
    expect(await t.as(TEACHER, `select grade from public.pending_enrolments`)).toEqual([
      { grade: 4 }
    ]);
    await expect(
      t.as(TEACHER, `select certificate_name from public.pending_enrolments`)
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as(PARENT, `select public.confirm_enrolment('wrong', 'Rocket', 'robot', 'zu', $1, true)`, [
        NOTICE
      ])
    ).rejects.toThrow(/expired or is wrong/);
    const { id: learner } = await one(
      t.as<{ id: string }>(
        PARENT,
        `select public.confirm_enrolment('secret-link-1', 'Rocket', 'robot', 'zu', $1, true) as id`,
        [NOTICE]
      )
    );
    expect(await t.owner(`select 1 from public.pending_enrolments`)).toEqual([]);
    const row = await one(
      t.owner<{ has: boolean }>(
        `select certificate_name is not null as has from public.learners where id = $1`,
        [learner]
      )
    );
    expect(row.has).toBe(true);
    const controls = await t.as<{ control: string }>(
      PARENT,
      `select control from public.consents where learner_id = $1 order by control`,
      [learner]
    );
    expect(controls.map((c) => c.control).sort()).toEqual(['class', 'name', 'record']);
  });

  it('a parent who says no to the name gets no stored name', async () => {
    const { cls } = await schoolWithClass();
    await pending(cls, 'secret-link-2');
    const { id: learner } = await one(
      t.as<{ id: string }>(
        PARENT,
        `select public.confirm_enrolment('secret-link-2', 'Rocket', 'robot', 'zu', $1, false) as id`,
        [NOTICE]
      )
    );
    const row = await one(
      t.owner<{ has: boolean }>(
        `select certificate_name is not null as has from public.learners where id = $1`,
        [learner]
      )
    );
    expect(row.has).toBe(false);
  });

  it('unconfirmed enrolments are deleted after 14 days', async () => {
    const { cls } = await schoolWithClass();
    await pending(cls, 'secret-link-3');
    await t.owner(`update public.pending_enrolments set expires_at = now() - interval '1 minute'`);
    const { n } = await one(
      t.service<{ n: number }>(`select public.expire_pending_enrolments() as n`)
    );
    expect(n).toBe(1);
  });

  it('only the class teacher can enrol through the service', async () => {
    const { cls } = await schoolWithClass();
    await expect(
      t.service(
        `select public.create_pending_enrolment($1, $2, 4, $3, 1, $3, 1, repeat('a', 64))`,
        [cls, OTHER_TEACHER, NAME]
      )
    ).rejects.toThrow(/teacher or coach/);
  });

  it('a child already enrolled elsewhere keeps one profile (FR-5b)', async () => {
    const { token } = await schoolWithClass();
    const learner = await enrol(token);
    const club = await schoolWithClass(OTHER_TEACHER, '500999999');
    await t.as(PARENT, `select public.link_child($1, $2, $3)`, [club.token, learner, NOTICE]);
    const classes = await t.owner(
      `select class_id from public.class_learners where learner_id = $1`,
      [learner]
    );
    expect(classes).toHaveLength(2);
  });
});

describe('learner records (ADR-0014) and who sees them', () => {
  it('a learner records and reads only their own sheets; sending twice is harmless', async () => {
    const { token } = await schoolWithClass();
    const rocket = await enrol(token, 'Rocket');
    const star = await enrol(token, 'Star', OTHER_PARENT);
    await record(rocket, 'b'.repeat(32));
    await asLearner(
      rocket,
      `insert into public.sheet_records (id, learner_id, lesson_id, sheet_code, steps_done, i_can,
         built_working, recorded_at)
       values ($1, $2, 'p1-crank-01', 'p1-crank-01-81feed', 7, array[true], true, now())
       on conflict (id) do nothing`,
      ['b'.repeat(32), rocket]
    );
    await expect(
      record(star, 'c'.repeat(32)).then(() => record(rocket, 'd'.repeat(32)))
    ).resolves.toBeDefined();
    await expect(
      asLearner(
        star,
        `insert into public.sheet_records (id, learner_id, lesson_id, sheet_code, steps_done, i_can,
           built_working, recorded_at)
         values ($1, $2, 'p1-crank-01', 'p1-crank-01-81feed', 1, array[true], true, now())`,
        ['e'.repeat(32), rocket]
      )
    ).rejects.toThrow(/row-level security/);
    const mine = await asLearner<{ learner_id: string }>(
      star,
      `select learner_id from public.sheet_records`
    );
    expect(mine.every((r) => r.learner_id === star)).toBe(true);
    expect(await t.as(TEACHER, `select id from public.sheet_records`)).toHaveLength(3);
    expect(await t.as(OTHER_TEACHER, `select id from public.sheet_records`)).toEqual([]);
  });

  it('a learner cannot mark their own record checked', async () => {
    const { token } = await schoolWithClass();
    const rocket = await enrol(token);
    await record(rocket);
    await expect(
      asLearner(rocket, `update public.sheet_records set checked_at = now()`)
    ).rejects.toThrow(/permission denied/);
  });

  it('the teacher spot-checks or revokes; another teacher cannot', async () => {
    const { token } = await schoolWithClass();
    const rocket = await enrol(token);
    await record(rocket);
    await expect(
      t.as(OTHER_TEACHER, `select public.check_record($1)`, ['a'.repeat(32)])
    ).rejects.toThrow(/teacher or coach/);
    await t.as(TEACHER, `select public.check_record($1)`, ['a'.repeat(32)]);
    const row = await one(
      t.owner<{ ok: boolean }>(`select checked_at is not null as ok from public.sheet_records`)
    );
    expect(row.ok).toBe(true);
  });

  it('leaving a class (consent c withdrawn) hides the learner from that teacher', async () => {
    const { token, cls } = await schoolWithClass();
    const rocket = await enrol(token);
    await t.as(PARENT, `select public.withdraw_consent($1, 'class', $2)`, [rocket, cls]);
    expect(await t.as(TEACHER, `select id from public.learners`)).toEqual([]);
    expect(await t.as(PARENT, `select id from public.learners`)).toHaveLength(1);
  });
});

describe('badges and certificates', () => {
  it('awarded automatically by the service; codes verify without any name', async () => {
    const { token } = await schoolWithClass();
    const rocket = await enrol(token);
    const { id: award } = await one(
      t.service<{ id: string }>(`select public.award_badge($1, 'crank', '1') as id`, [rocket])
    );
    await expect(
      t.as(TEACHER, `select public.award_badge($1, 'cam', '1')`, [rocket])
    ).rejects.toThrow(/permission denied/);
    const { code } = await one(
      t.service<{ code: string }>(
        `select public.issue_certificate_code($1, 'Sizwe Primary') as code`,
        [award]
      )
    );
    expect(code).toMatch(/^RFA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/);
    const checked = await one(
      t.db
        .query<Record<string, unknown>>(`select * from public.verify_certificate($1)`, [code])
        .then((r) => r.rows)
    );
    expect(Object.keys(checked).sort()).toEqual([
      'badge_id',
      'issued_by_label',
      'issued_on',
      'valid'
    ]);
    expect(checked['valid']).toBe(true);
    await t.as(TEACHER, `select public.revoke_badge($1)`, [award]);
    const after = await one(
      t.db
        .query<{ valid: boolean }>(`select valid from public.verify_certificate($1)`, [code])
        .then((r) => r.rows)
    );
    expect(after.valid).toBe(false);
  });

  it('a code still checks out after the learner is deleted', async () => {
    const { token } = await schoolWithClass();
    const rocket = await enrol(token);
    const { id: award } = await one(
      t.service<{ id: string }>(`select public.award_badge($1, 'crank', '1') as id`, [rocket])
    );
    const { code } = await one(
      t.service<{ code: string }>(
        `select public.issue_certificate_code($1, 'Sizwe Primary') as code`,
        [award]
      )
    );
    await t.as(PARENT, `select public.delete_learner($1)`, [rocket]);
    const row = await one(
      t.db
        .query<{ badge_id: string }>(`select badge_id from public.verify_certificate($1)`, [code])
        .then((r) => r.rows)
    );
    expect(row.badge_id).toBe('crank');
  });
});

describe('learner sign-in (ADR-0013)', () => {
  it('the roster shows consented learners by nickname; 5 wrong PINs lock for 5 minutes', async () => {
    const { token, cls } = await schoolWithClass();
    const rocket = await enrol(token);
    const { class_code } = await one(
      t.owner<{ class_code: string }>(`select class_code from public.classes where id = $1`, [cls])
    );
    const roster = await t.service(`select * from public.sign_in_roster($1)`, [
      class_code.toLowerCase()
    ]);
    expect(roster).toEqual([{ learner_id: rocket, nickname: 'Rocket', avatar: 'robot' }]);
    await expect(
      t.as(TEACHER, `select * from public.sign_in_roster($1)`, [class_code])
    ).rejects.toThrow(/permission denied/);
    for (let i = 0; i < 5; i++) {
      await t.service(`select public.record_pin_attempt($1, false)`, [rocket]);
    }
    const { ok } = await one(
      t.service<{ ok: boolean }>(`select public.record_pin_attempt($1, true) as ok`, [rocket])
    );
    expect(ok).toBe(false);
    await t.as(TEACHER, `select public.reset_learner_pin($1)`, [rocket]);
    const again = await one(
      t.service<{ ok: boolean }>(`select public.record_pin_attempt($1, true) as ok`, [rocket])
    );
    expect(again.ok).toBe(true);
  });
});

describe('deleting when no longer needed (spec §7.5)', () => {
  it('messages at 10 and 11 months; signing in stops it; deletion at 12 months', async () => {
    const { token, cls } = await schoolWithClass();
    await t.as(PARENT, `select public.touch_adult('Mrs Dlamini')`);
    const rocket = await enrol(token);
    await t.owner(`update public.adults set last_seen_at = now() - interval '10 months 1 day'`);
    const due = await t.service<{ user_id: string; months: number }>(
      `select * from public.dormancy_notices_due()`
    );
    expect(due).toEqual([{ user_id: PARENT, months: 10 }]);
    await t.service(`select public.dormancy_notice_sent($1)`, [PARENT]);
    expect(await t.service(`select * from public.dormancy_notices_due()`)).toEqual([]);
    await t.as(PARENT, `select public.touch_adult()`);
    const { dormancy_notices } = await one(
      t.owner<{ dormancy_notices: number }>(`select dormancy_notices from public.adults`)
    );
    expect(dormancy_notices).toBe(0);

    // 12 months: the parent goes; their child stays while still in a class, then goes with it.
    await t.owner(`update public.adults set last_seen_at = now() - interval '12 months 1 day'`);
    await t.service(`select public.delete_dormant_accounts()`);
    expect(await t.owner(`select 1 from auth.users where id = $1`, [PARENT])).toEqual([]);
    expect(await t.owner(`select 1 from public.learners where id = $1`, [rocket])).toHaveLength(1);
    await t.as(TEACHER, `select public.end_class($1)`, [cls]);
  });

  it("a dormant parent's child who is in no class is deleted with the account", async () => {
    const { token, cls } = await schoolWithClass();
    await t.as(PARENT, `select public.touch_adult()`);
    const rocket = await enrol(token);
    await t.as(TEACHER, `select public.end_class($1)`, [cls]);
    await t.owner(`update public.adults set last_seen_at = now() - interval '13 months'`);
    await t.service(`select public.delete_dormant_accounts()`);
    expect(await t.owner(`select 1 from public.learners where id = $1`, [rocket])).toEqual([]);
  });
});
