// Finds every template sheet in content/projects/<lesson>/templates/<name>.ts (M2 spec FR-5).
// A sheet can be drawn in another language: the same shapes, with its own words from the lesson
// translation and the interface words (translate-templates spec §2.1–2.3).
import {
  type Fact,
  inWords,
  measurements,
  renderSheet,
  type Say,
  type SheetDefinition,
  type SheetWords
} from '../../../../packages/templates/src/index';
import { m } from '../i18n';

const modules = import.meta.glob<{ default: SheetDefinition }>(
  '../../../../content/projects/*/templates/*.ts',
  { eager: true }
);

export interface TemplateEntry {
  lesson: string;
  name: string;
  sheet: SheetDefinition;
}

export const templates: TemplateEntry[] = Object.entries(modules).map(([path, mod]) => {
  const match = /projects\/([^/]+)\/templates\/([^/]+)\.ts$/.exec(path);
  if (!match?.[1] || !match[2]) throw new Error(`Unexpected template path: ${path}`);
  return { lesson: match[1], name: match[2], sheet: mod.default };
});

export function findTemplate(lesson: string, name: string): TemplateEntry | undefined {
  return templates.find((t) => t.lesson === lesson && t.name === name);
}

type Locale = Parameters<typeof m.template_key>[1] extends infer O
  ? O extends { locale?: infer L }
    ? L
    : never
  : never;

/** The measurement sentences in a language (interface words, spec §2.2). */
export function say(locale: string): Say {
  const o = { locale: locale as Locale };
  return (f: Fact, name: string) => {
    switch (f.kind) {
      case 'strip':
        return m.template_fact_strip({ name, length: f.length, width: f.width }, o);
      case 'strip_holes':
        return m.template_fact_strip_holes(
          { count: f.count, inset: f.inset, spacing: f.spacing },
          o
        );
      case 'strip_middle_hole':
        return m.template_fact_strip_middle_hole({}, o);
      case 'disc':
        return m.template_fact_disc({ name, diameter: f.diameter }, o);
      case 'disc_holes':
        return m.template_fact_disc_holes({ offsets: f.offsets }, o);
      case 'gear':
        return m.template_fact_gear({ name, teeth: f.teeth, tips: f.tips }, o);
      case 'gear_spacing':
        return m.template_fact_gear_spacing({ radius: f.radius }, o);
      case 'cam':
        return m.template_fact_cam({ name, base: f.base, height: f.height }, o);
      case 'shape':
        return m.template_fact_shape({ name, width: f.width, height: f.height }, o);
    }
  };
}

/**
 * The sheet as an SVG file. With `words` (a lesson translation's), the sheet's own words are in
 * that language and so are the printed instructions; the shapes never change.
 */
export function templateSvg(entry: TemplateEntry, locale = 'en', words?: SheetWords): string {
  const o = { locale: locale as Locale };
  return renderSheet(inWords(entry.sheet, words), {
    checkSquare: m.template_check_square({}, o),
    key: m.template_key({}, o)
  });
}

export function templateMeasurements(
  entry: TemplateEntry,
  locale = 'en',
  words?: SheetWords
): string[] {
  return measurements(inWords(entry.sheet, words), say(locale));
}

export const templatePage = (lesson: string, name: string) => `/templates/${lesson}/${name}/`;
/** The sheet file; a translated sheet is `<name>.<lang>.svg` beside the English one. */
export const templateFile = (lesson: string, name: string, lang = 'en') =>
  `/templates/${lesson}/${name}${lang === 'en' ? '' : `.${lang}`}.svg`;
