// AI → Helper settings (M6 spec FR-28 to FR-30): turns the form into the changes the database
// takes (helper_settings_update, migration 0028), and shapes the usage totals for the page. The
// database checks the owner role, the ranges and writes the audit log; this keeps choices to the
// allowed models (with children's safety) and the prompt versions that exist.
import { PROMPTS } from '../../../helper/src/prompts';
import { ALLOWED } from '../../../helper/src/providers/models';

export interface HelperSettings {
  enabled: boolean;
  children_enabled: boolean;
  adult_daily: number;
  child_daily: number;
  class_daily_per_learner: number;
  month_questions: number;
  month_budget_cents: number;
  refusals_to_pause: number;
  adult_model: string;
  child_model: string;
  faq_model: string;
  adult_prompt: string;
  child_prompt: string;
  faq_prompt: string;
}

export const MODELS = Object.keys(ALLOWED);
/** Models a child may be answered by: providers that don't keep or train on inputs (FR-26). */
export const CHILD_MODELS = MODELS.filter((m) => ALLOWED[m]?.forChildren);
export const promptsFor = (audience: 'adult' | 'child' | 'faq'): string[] =>
  Object.keys(PROMPTS).filter((p) => p.startsWith(`${audience}-v`));

const NUMBERS: { key: keyof HelperSettings; label: string; min: number; max: number }[] = [
  { key: 'adult_daily', label: 'Questions per adult per day', min: 0, max: 200 },
  { key: 'child_daily', label: 'Questions per child per day', min: 0, max: 50 },
  { key: 'class_daily_per_learner', label: 'Class questions per learner per day', min: 0, max: 50 },
  { key: 'month_questions', label: 'Questions per month (whole site)', min: 0, max: 10_000_000 },
  { key: 'refusals_to_pause', label: 'Refused questions before a pause', min: 1, max: 20 }
];
export const NUMBER_FIELDS = NUMBERS;

/** The changes to send, and any problems (nothing is sent while there are problems). */
export function changesFromForm(
  form: FormData,
  current: HelperSettings
): { changes: Partial<HelperSettings>; problems: string[] } {
  const problems: string[] = [];
  const changes: Partial<HelperSettings> = {};
  const set = <K extends keyof HelperSettings>(k: K, v: HelperSettings[K]) => {
    if (current[k] !== v) changes[k] = v;
  };
  set('enabled', form.get('enabled') === 'on');
  set('children_enabled', form.get('children_enabled') === 'on');
  for (const { key, label, min, max } of NUMBERS) {
    const raw = String(form.get(key) ?? '').trim();
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || n < min || n > max) {
      problems.push(`${label}: a whole number from ${min} to ${max}.`);
    } else {
      set(key, n as never);
    }
  }
  const rand = String(form.get('month_budget_rand') ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(rand) || Number(rand) > 1_000_000) {
    problems.push('Monthly budget: an amount in rand, e.g. 500 or 500.00.');
  } else {
    set('month_budget_cents', Math.round(Number(rand) * 100));
  }
  const pick = (
    key: 'adult_model' | 'child_model' | 'faq_model',
    allowed: string[],
    label: string
  ) => {
    const v = String(form.get(key) ?? '');
    if (!allowed.includes(v)) problems.push(`${label}: choose one from the list.`);
    else set(key, v);
  };
  pick('adult_model', MODELS, 'Model for adults');
  pick('child_model', CHILD_MODELS, 'Model for children');
  pick('faq_model', CHILD_MODELS, 'Model for Common questions');
  for (const a of ['adult', 'child', 'faq'] as const) {
    const key = `${a}_prompt` as const;
    const v = String(form.get(key) ?? '');
    if (!promptsFor(a).includes(v))
      problems.push(`Instructions for ${a}: choose one from the list.`);
    else set(key, v);
  }
  return { changes: problems.length ? {} : changes, problems };
}

export interface DayRow {
  day: string;
  audience: 'adult' | 'child' | 'faq';
  asked: number;
  refused: number;
  blocked: number;
  thumbs_up: number;
  thumbs_down: number;
}

/** Totals per audience over the rows shown. */
export function totals(
  rows: DayRow[]
): Record<DayRow['audience'], Omit<DayRow, 'day' | 'audience'>> {
  const zero = () => ({ asked: 0, refused: 0, blocked: 0, thumbs_up: 0, thumbs_down: 0 });
  const out = { adult: zero(), child: zero(), faq: zero() };
  for (const r of rows) {
    const t = out[r.audience];
    t.asked += r.asked;
    t.refused += r.refused;
    t.blocked += r.blocked;
    t.thumbs_up += r.thumbs_up;
    t.thumbs_down += r.thumbs_down;
  }
  return out;
}

/** Share of a cap used, 0–100 (rounded down), or null when the cap is 0. */
export const percent = (used: number, cap: number): number | null =>
  cap > 0 ? Math.min(100, Math.floor((used / cap) * 100)) : null;
