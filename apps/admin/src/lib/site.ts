// Configuration → Site (docs/specs/back-office.md §6.7): turn the form into a checked
// content/site/settings.json, ready for a pull request. Same checks as the public build.
import { prettyJson } from '../../../../packages/settings/src/json';
import {
  checkSettings,
  FEATURES,
  type SettingsProblem
} from '../../../../packages/settings/src/site';

export const SITE_SETTINGS_PATH = 'content/site/settings.json';

/** Names of the switches as admins see them. */
export const FEATURE_LABELS: Record<(typeof FEATURES)[number], string> = {
  robot_world: 'Robot tab in the code editor (robot worlds and courses)',
  print_course: 'Print course button',
  seasons: 'Seasons (grouping and banner in the Robot tab)',
  send_to_microbit: 'Send to micro:bit button',
  accounts: 'Accounts: sign-in, classes and progress (M5)',
  ai_helper:
    'AI helper panel on the home page and lesson pages (M6; also switch it on in AI → Helper settings)'
};

/** The settings file from the form's fields; problems are listed, nothing is thrown. */
export function settingsFromForm(form: FormData): { text: string; problems: SettingsProblem[] } {
  const field = (k: string) => String(form.get(k) ?? '').trim();
  const link = field('link');
  const announcement =
    form.get('banner') === 'on'
      ? {
          from: field('from'),
          to: field('to'),
          text: { en: field('text_en') },
          ...(link ? { link } : {})
        }
      : null;
  const features = Object.fromEntries(FEATURES.map((f) => [f, form.get(`feature_${f}`) === 'on']));
  const spec = { announcement, features };
  return { text: prettyJson(spec), problems: checkSettings(spec) };
}
