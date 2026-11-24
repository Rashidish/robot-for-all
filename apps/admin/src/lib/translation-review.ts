// Reviewing a lesson translation (more content spec §2.7): content/lessons/<id>/index.<lang>.md.
// Its id in the back office and the database is "<lesson>/<language>", e.g. "p1-crank-01/zu".
// A decision changes only its status and reviewed_by lines (ADR-0012 condition 2). It has no
// build test: the English lesson was built and tested; the words are what a reviewer checks.
import type { ContentKind, Item } from './kinds';
import { LANGUAGE_CHECKLIST } from './language-review';
import { onlyStatusChanged } from './lessons';
import { TRANSLATION_FILE, translationIds } from './translation-files';

export { TRANSLATION_FILE, translationIds };

export const TRANSLATION_CHECKLIST: { key: string; label: string }[] = [
  ...LANGUAGE_CHECKLIST,
  {
    key: 'ai_read',
    label: 'I read every section beside the English (required for AI-drafted translations)'
  }
];

export const TRANSLATION_ID = /^(p[1-3]-[a-z]+-\d{2})\/([a-z]{2,3})$/;

export function splitTranslationId(id: string): { lesson: string; lang: string } {
  const m = TRANSLATION_ID.exec(id);
  if (!m?.[1] || !m[2] || m[2] === 'en') throw new Error(`"${id}" is not a lesson translation.`);
  return { lesson: m[1], lang: m[2] };
}

export const translationPath = (id: string): string => {
  const { lesson, lang } = splitTranslationId(id);
  return `content/lessons/${lesson}/index.${lang}.md`;
};

export interface TranslationItem extends Item {
  /** The English text it was translated from (16 hex characters). */
  translatedFrom: string | null;
  aiGenerated: boolean;
  /** Template sheets it has words for (the keys under `templates:`). */
  templates: string[];
}

const FRONT = /^---\n([\s\S]*?)\n---\n/;

function field(front: string, key: string): string | null {
  const m = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(front);
  const v = m ? (m[1] ?? '').trim() : null;
  if (v === null || v === '' || v === 'null' || v === '~') return null;
  return v.replace(/^(['"])(.*)\1$/, '$2');
}

/** The sheet names under `templates:` in a translation's front matter. */
function sheetNames(front: string): string[] {
  const lines = front.split('\n');
  const start = lines.indexOf('templates:');
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith(' ')) break;
    const m = /^ {2}([a-z0-9-]+):\s*$/.exec(line);
    if (m?.[1]) out.push(m[1]);
  }
  return out;
}

export function summariseTranslation(id: string, text: string): TranslationItem {
  const front = FRONT.exec(text.replace(/\r\n/g, '\n'))?.[1] ?? '';
  const status = field(front, 'status');
  return {
    id,
    title: field(front, 'title') ?? id,
    status: status === 'in_review' || status === 'published' ? status : 'draft',
    reviewedBy: field(front, 'reviewed_by'),
    // A translation has no build test: "n/a" keeps that decision off the page.
    buildTestedBy: 'n/a',
    translatedFrom: field(front, 'translated_from'),
    aiGenerated: field(front, 'ai_generated') === 'true',
    templates: sheetNames(front)
  };
}

/** The translation file with new status and reviewed_by lines; nothing else changes. */
export function withTranslationStatus(
  text: string,
  change: { status?: Item['status']; reviewedBy?: string | null }
): string {
  const m = FRONT.exec(text);
  if (!m) throw new Error('translation has no front matter');
  let front = m[1] ?? '';
  const set = (key: 'status' | 'reviewed_by', value: string) => {
    const re = new RegExp(`^${key}:.*$`, 'm');
    if (!re.test(front)) throw new Error(`translation front matter has no ${key} line`);
    front = front.replace(re, `${key}: ${value}`);
  };
  if (change.status !== undefined) set('status', change.status);
  if (change.reviewedBy !== undefined)
    set(
      'reviewed_by',
      change.reviewedBy === null ? 'null' : JSON.stringify(change.reviewedBy.trim())
    );
  return text.replace(FRONT, `---\n${front}\n---\n`);
}

/** Lesson translations: approving publishes it (it shows once the English lesson is live too). */
export const TRANSLATION: ContentKind<TranslationItem> = {
  type: 'translation',
  noun: 'translation',
  path: translationPath,
  list: { folder: 'content/lessons', entries: 'dirs' },
  summarise: summariseTranslation,
  withStatus: withTranslationStatus,
  onlyStatusChanged,
  after: (_t, decision, name) => {
    switch (decision) {
      case 'sent_for_review':
        return { status: 'in_review' };
      case 'approved':
        return { status: 'published', reviewedBy: name };
      case 'changes_requested':
      case 'unpublished':
        return { status: 'draft', reviewedBy: null };
      case 'build_tested':
        return {};
    }
  },
  checklist: TRANSLATION_CHECKLIST
};

/**
 * A lesson file cut into parts to show beside each other: the front matter first, then one part
 * per `##` section. The translation has the same sections in the same order (the build checks).
 */
export function lessonParts(text: string): { heading: string; text: string }[] {
  const t = text.replace(/\r\n/g, '\n');
  const m = FRONT.exec(t);
  const front = m?.[1] ?? '';
  const body = m ? t.slice(m[0].length) : t;
  const parts = [{ heading: 'Front matter', text: front }];
  for (const chunk of body.split(/^(?=##\s)/m)) {
    const h = /^##\s+(.+?)\s*$/m.exec(chunk);
    if (!h) continue;
    parts.push({ heading: h[1] ?? '', text: chunk.slice((h.index ?? 0) + h[0].length).trim() });
  }
  return parts;
}

/** A template sheet's words as written in its source file: the title, part names and notes. */
export function sheetSourceWords(source: string): string {
  return source
    .split('\n')
    .filter((l) => /\b(title|name):/.test(l) || /^\s*(measurements: )?\[?'/.test(l))
    .map((l) => l.trim())
    .join('\n');
}

/** One sheet's block under `templates:` in a translation's front matter, as written. */
export function translatedSheet(front: string, sheet: string): string {
  const lines = front.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => l === `  ${sheet}:`);
  if (start < 0 || !lines.slice(0, start).some((l) => l === 'templates:')) return '';
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('    ')) break;
    out.push(line.slice(4));
  }
  return out.join('\n').trim();
}
