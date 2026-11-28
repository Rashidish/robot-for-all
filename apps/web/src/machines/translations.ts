// Topic translations (machines spec FR-10): content/machines/<id>/index.<lang>.md holds only the
// translated words. Checked against the English topic when the site is built; each page gets the
// topic in its own language when one may be shown, else the English topic with a notice.
import { getCollection, type CollectionEntry } from 'astro:content';
import list from '../../../../content/i18n/languages.json';
import { translationHash, translationView } from '../../../../packages/settings/src/translation';
import type { MachineEntry } from './load';
import { type Machine, machineTranslationProblems } from './schema';

export type MachineTranslationEntry = CollectionEntry<'machineTranslations'>;

const englishFiles = import.meta.glob<string>('../../../../content/machines/*/index.md', {
  eager: true,
  query: '?raw',
  import: 'default'
});
const pictureFiles = import.meta.glob<string>('../../../../content/machines/*/picture.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
});

const fileOf = (files: Record<string, string>, topic: string, name: string) =>
  Object.entries(files).find(([path]) => path.endsWith(`/machines/${topic}/${name}`))?.[1];

/**
 * The `translated_from` value for a topic: its index.md (without the review lines) and its
 * picture, so a changed picture (new callouts) also marks translations "needs updating".
 */
export async function machineHash(topic: string): Promise<string | undefined> {
  const file = fileOf(englishFiles, topic, 'index.md');
  const svg = fileOf(pictureFiles, topic, 'picture.svg');
  if (file === undefined) return undefined;
  return translationHash(file, svg === undefined ? [] : [{ name: 'picture.svg', text: svg }]);
}

export interface CheckedMachineTranslation {
  entry: MachineTranslationEntry;
  topic: string;
  lang: string;
  stale: boolean;
}

let checked: Promise<CheckedMachineTranslation[]> | undefined;

/** Every topic translation, checked; a problem fails the build, like a broken topic. */
export function getMachineTranslations(): Promise<CheckedMachineTranslation[]> {
  checked ??= (async () => {
    const all = await getCollection('machineTranslations');
    const topics = new Map((await getCollection('machines')).map((t) => [t.id, t]));
    const codes = new Set(list.languages.map((l) => l.code).filter((c) => c !== 'en'));
    const problems: string[] = [];
    const out: CheckedMachineTranslation[] = [];
    for (const entry of all) {
      const dot = entry.id.lastIndexOf('.');
      const topic = entry.id.slice(0, dot);
      const lang = entry.id.slice(dot + 1);
      const where = `content/machines/${topic}/index.${lang}.md`;
      if (!codes.has(lang)) {
        problems.push(`${where}: "${lang}" is not a language in content/i18n/languages.json`);
        continue;
      }
      const english = topics.get(topic);
      const hash = await machineHash(topic);
      if (!english || hash === undefined) {
        problems.push(`${where}: there is no English topic content/machines/${topic}/index.md`);
        continue;
      }
      for (const p of machineTranslationProblems(
        english.data,
        english.body ?? '',
        entry.data,
        entry.body ?? ''
      ))
        problems.push(`${where}: ${p}`);
      out.push({ entry, topic, lang, stale: entry.data.translated_from !== hash });
    }
    if (problems.length > 0) {
      throw new Error(`Topic translation problems:\n- ${problems.join('\n- ')}`);
    }
    return out;
  })();
  return checked;
}

/** Why a page in another language shows the English topic, or a translation not yet live. */
export type MachineNotice = 'english' | 'draft' | 'stale' | null;

export interface LocalMachine {
  /** The topic's data, with the translated words in place of the English ones. */
  data: Machine;
  /** What to render: the translation, or the English topic. */
  entry: MachineEntry | MachineTranslationEntry;
  /** The language the topic's words are in (the page may be in another). */
  lang: string;
  notice: MachineNotice;
}

/**
 * The topic for a page in `lang`. Production shows a translation only when it is published and
 * up to date; otherwise the English topic, with a notice. The drafts preview shows every
 * translation, with a notice.
 */
export async function localMachine(
  topic: MachineEntry,
  lang: string,
  showDrafts: boolean = __RFA_SHOW_DRAFTS__
): Promise<LocalMachine> {
  const english: LocalMachine = {
    data: topic.data,
    entry: topic,
    lang: 'en',
    notice: lang === 'en' ? null : 'english'
  };
  if (lang === 'en') return english;
  const t = (await getMachineTranslations()).find((x) => x.topic === topic.id && x.lang === lang);
  if (!t) return english;
  const view = translationView(t.entry.data.status, t.stale, showDrafts);
  if (view === 'english') return english;
  const w = t.entry.data;
  return {
    data: {
      ...topic.data,
      title: w.title,
      card: w.card,
      picture_alt: w.picture_alt,
      stand_ins: topic.data.stand_ins.map((s, i) => ({
        item: w.stand_ins[i]?.item ?? s.item,
        ...(s.note ? { note: w.stand_ins[i]?.note ?? s.note } : {})
      })),
      real_part: w.real_part,
      safety: { ...topic.data.safety, notes: w.safety_notes }
    },
    entry: t.entry,
    lang,
    notice: view === 'live' ? null : view
  };
}
