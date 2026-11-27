// AI → Helper settings (M6 spec FR-28 to FR-30).
import { describe, expect, it } from 'vitest';
import {
  changesFromForm,
  CHILD_MODELS,
  type HelperSettings,
  MODELS,
  percent,
  promptsFor,
  totals
} from './helper';

const current: HelperSettings = {
  enabled: false,
  children_enabled: false,
  adult_daily: 20,
  child_daily: 5,
  class_daily_per_learner: 5,
  month_questions: 20000,
  month_budget_cents: 50000,
  refusals_to_pause: 3,
  adult_model: 'claude-haiku-5-5',
  child_model: 'claude-haiku-5-5',
  faq_model: 'claude-haiku-5-5',
  adult_prompt: 'adult-v1',
  child_prompt: 'child-v1',
  faq_prompt: 'faq-v1'
};
const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const fields: Record<string, string> = {
    adult_daily: '20',
    child_daily: '5',
    class_daily_per_learner: '5',
    month_questions: '20000',
    refusals_to_pause: '3',
    month_budget_rand: '500',
    adult_model: 'claude-haiku-5-5',
    child_model: 'claude-haiku-5-5',
    faq_model: 'claude-haiku-5-5',
    adult_prompt: 'adult-v1',
    child_prompt: 'child-v1',
    faq_prompt: 'faq-v1',
    ...over
  };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('Helper settings form', () => {
  it('sends only what changed; the budget is typed in rand and kept in cents', () => {
    expect(changesFromForm(form(), current)).toEqual({ changes: {}, problems: [] });
    expect(
      changesFromForm(
        form({
          enabled: 'on',
          adult_daily: '10',
          month_budget_rand: '750.50',
          adult_model: 'claude-sonnet-5-5'
        }),
        current
      )
    ).toEqual({
      changes: {
        enabled: true,
        adult_daily: 10,
        month_budget_cents: 75050,
        adult_model: 'claude-sonnet-5-5'
      },
      problems: []
    });
  });

  it('refuses out-of-range numbers, unknown models and prompt versions of another audience', () => {
    const { changes, problems } = changesFromForm(
      form({
        child_daily: '99',
        month_budget_rand: 'lots',
        faq_model: 'free-model-x',
        child_prompt: 'adult-v1'
      }),
      current
    );
    expect(changes).toEqual({});
    expect(problems).toEqual([
      'Questions per child per day: a whole number from 0 to 50.',
      'Monthly budget: an amount in rand, e.g. 500 or 500.00.',
      'Model for Common questions: choose one from the list.',
      'Instructions for child: choose one from the list.'
    ]);
  });

  it('offers only allowed models, and for children only those safe for them', () => {
    expect(MODELS).toContain('claude-haiku-5-5');
    expect(CHILD_MODELS.every((m) => MODELS.includes(m))).toBe(true);
    expect(promptsFor('child')).toEqual(['child-v1']);
  });
});

describe('usage', () => {
  it('adds up the days per audience and shows a share of each cap', () => {
    expect(
      totals([
        {
          day: '2026-11-27',
          audience: 'adult',
          asked: 3,
          refused: 1,
          blocked: 0,
          thumbs_up: 2,
          thumbs_down: 0
        },
        {
          day: '2026-11-26',
          audience: 'adult',
          asked: 4,
          refused: 0,
          blocked: 1,
          thumbs_up: 0,
          thumbs_down: 1
        },
        {
          day: '2026-11-27',
          audience: 'child',
          asked: 2,
          refused: 0,
          blocked: 0,
          thumbs_up: 1,
          thumbs_down: 0
        }
      ]).adult
    ).toEqual({ asked: 7, refused: 1, blocked: 1, thumbs_up: 2, thumbs_down: 1 });
    expect(percent(16500, 20000)).toBe(82);
    expect(percent(5, 0)).toBeNull();
    expect(percent(30000, 20000)).toBe(100);
  });
});
