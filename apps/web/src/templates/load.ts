// Finds every template sheet in content/projects/<lesson>/templates/<name>.ts (M2 spec FR-5).
import {
  renderSheet,
  measurements,
  type SheetDefinition
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

export function templateSvg(entry: TemplateEntry): string {
  return renderSheet(entry.sheet, {
    checkSquare: m.template_check_square(),
    key: m.template_key()
  });
}

export function templateMeasurements(entry: TemplateEntry): string[] {
  return measurements(entry.sheet);
}

export const templatePage = (lesson: string, name: string) => `/templates/${lesson}/${name}/`;
export const templateFile = (lesson: string, name: string) => `/templates/${lesson}/${name}.svg`;
