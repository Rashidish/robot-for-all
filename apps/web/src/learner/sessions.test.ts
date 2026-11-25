import { describe, expect, it } from 'vitest';
import {
  cleanCode,
  clearCurrentLearner,
  currentLearner,
  type LearnerSession,
  liveSessions,
  PIN_PICTURES,
  type SessionStore,
  setCurrentLearner,
  validCode
} from './sessions';

const memoryStore = (
  rows: LearnerSession[]
): SessionStore & { rows: Map<string, LearnerSession> } => {
  const map = new Map(rows.map((r) => [r.learnerId, r]));
  return {
    rows: map,
    all: async () => [...map.values()],
    put: async (s) => void map.set(s.learnerId, s),
    remove: async (id) => void map.delete(id)
  };
};
const s = (id: string, nickname: string, expiresAt: number): LearnerSession => ({
  learnerId: id,
  nickname,
  avatar: 'robot',
  token: `t-${id}`,
  expiresAt
});

describe('learner sessions on a shared phone', () => {
  it('has 9 pictures, each once', () => {
    expect(new Set(PIN_PICTURES.map((p) => p.id)).size).toBe(9);
  });

  it('keeps each learner’s own session and drops expired ones', async () => {
    const store = memoryStore([
      s('b', 'Sipho M', 2000),
      s('a', 'Thandi R', 2000),
      s('c', 'Old', 1000)
    ]);
    const live = await liveSessions(store, 1500);
    expect(live.map((x) => x.nickname)).toEqual(['Sipho M', 'Thandi R']);
    expect(store.rows.has('c')).toBe(false);
  });

  it('forgets who is using the phone after 10 idle minutes', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k)
    };
    setCurrentLearner(storage, 'a', 0);
    expect(currentLearner(storage, 9 * 60_000)).toBe('a');
    expect(currentLearner(storage, 11 * 60_000)).toBeNull();
    setCurrentLearner(storage, 'a', 0);
    clearCurrentLearner(storage);
    expect(currentLearner(storage, 1)).toBeNull();
  });

  it('reads class codes typed any way', () => {
    expect(cleanCode(' bcd fgh ')).toBe('BCDFGH');
    expect(validCode(cleanCode('bcd-fgh'))).toBe(true);
    expect(validCode('ABCDEF')).toBe(false);
  });
});
