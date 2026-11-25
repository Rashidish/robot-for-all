// M5 step 5c (migration 0018): the teacher's view of sign-in, and QR sign-in cards.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TestDb } from './test-db';

const TEACHER = '00000000-0000-4000-8000-000000000011';
const OTHER_TEACHER = '00000000-0000-4000-8000-000000000012';
const PARENT = '00000000-0000-4000-8000-000000000021';
let t: TestDb;
let cls: string;
let learner: string;

const one = async <T>(p: Promise<T[]>): Promise<T> => {
  const [row] = await p;
  if (row === undefined) throw new Error('no row');
  return row;
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

beforeEach(async () => {
  t = await TestDb.create({
    [TEACHER]: 'teacher@example.org',
    [OTHER_TEACHER]: 'other@example.org',
    [PARENT]: 'parent@example.org'
  });
  for (const u of [TEACHER, OTHER_TEACHER, PARENT]) await t.as(u, `select public.touch_adult()`);
  const { id: org } = await one(
    t.as<{ id: string }>(
      TEACHER,
      `select public.register_organisation('school', 'Sizwe Primary', null, '500123456', null) as id`
    )
  );
  ({ id: cls } = await one(
    t.as<{ id: string }>(TEACHER, `select public.create_class($1, 'Grade 4B', '3-4', 'en') as id`, [
      org
    ])
  ));
  const { enrol_token } = await one(
    t.as<{ enrol_token: string }>(TEACHER, `select enrol_token from public.classes where id = $1`, [
      cls
    ])
  );
  ({ id: learner } = await one(
    t.as<{ id: string }>(
      PARENT,
      `select public.enrol_child($1, 'Thandi R', 4, 'rocket', 'en', '1.0') as id`,
      [enrol_token]
    )
  ));
});

describe('teacher’s view of sign-in (migration 0018)', () => {
  it('shows each learner’s PIN and lock state, never the PIN; only to the class’s staff', async () => {
    const status = () =>
      t.as(TEACHER, `select nickname, has_pin, locked from public.class_learner_status($1)`, [cls]);
    expect(await status()).toEqual([{ nickname: 'Thandi R', has_pin: false, locked: false }]);
    await t.owner(
      `update public.learners set pin_hash = 'pbkdf2$1$a$b', locked_until = now() + interval '5 minutes'`
    );
    expect(await status()).toEqual([{ nickname: 'Thandi R', has_pin: true, locked: true }]);
    await expect(
      t.as(OTHER_TEACHER, `select * from public.class_learner_status($1)`, [cls])
    ).rejects.toThrow(/only the class/);
  });
});

describe('QR sign-in cards (migration 0018)', () => {
  it('makes one card per learner; only the hash is kept; the service finds the learner', async () => {
    const [card] = await t.as<{ learner_id: string; nickname: string; secret: string }>(
      TEACHER,
      `select learner_id, nickname, secret from public.create_sign_in_cards($1)`,
      [cls]
    );
    expect(card?.nickname).toBe('Thandi R');
    expect(card?.secret).toMatch(/^[0-9a-f]{64}$/);
    const stored = await t.owner<{ secret_hash: string }>(
      `select secret_hash from public.sign_in_cards`
    );
    expect(stored).toEqual([{ secret_hash: hash(card?.secret ?? '') }]);
    expect(
      await t.service(`select learner_id, session_version from public.card_for_sign_in($1)`, [
        hash(card?.secret ?? '')
      ])
    ).toEqual([{ learner_id: learner, session_version: 1 }]);
  });

  it('new cards replace old ones; withdrawn cards and withdrawn consent sign nobody in', async () => {
    const first = await one(
      t.as<{ secret: string }>(TEACHER, `select secret from public.create_sign_in_cards($1)`, [cls])
    );
    const second = await one(
      t.as<{ secret: string }>(TEACHER, `select secret from public.create_sign_in_cards($1)`, [cls])
    );
    const find = (s: string) => t.service(`select * from public.card_for_sign_in($1)`, [hash(s)]);
    expect(await find(first.secret)).toEqual([]);
    expect(await find(second.secret)).toHaveLength(1);
    await t.as(PARENT, `select public.withdraw_consent($1, 'class', $2)`, [learner, cls]);
    expect(await find(second.secret)).toEqual([]);
    expect(await t.as(TEACHER, `select public.revoke_sign_in_cards($1) as n`, [cls])).toEqual([
      { n: 1 }
    ]);
  });

  it('only the class’s staff make or withdraw cards; browsers can’t look cards up', async () => {
    await expect(
      t.as(OTHER_TEACHER, `select * from public.create_sign_in_cards($1)`, [cls])
    ).rejects.toThrow(/only the class/);
    await expect(
      t.as(TEACHER, `select * from public.card_for_sign_in($1)`, ['a'.repeat(64)])
    ).rejects.toThrow(/permission denied/);
    await expect(t.as(TEACHER, `select * from public.sign_in_cards`)).rejects.toThrow(
      /permission denied/
    );
  });
});
