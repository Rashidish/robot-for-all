// Loads the Machines topics (machines spec §6) and enforces the rules that need the body, the
// folder or the lessons. A broken topic, or a lesson naming a missing one, fails the build.
import { getCollection, type CollectionEntry } from 'astro:content';
import { showDrafts } from '../lessons/load';
import { isVisible } from '../lessons/schema';
import { hidden } from '../withdrawn';
import { getMachineTranslations } from './translations';
import { MACHINE_FAMILIES, checkSections, linkProblems, type MachineFamily } from './schema';

export type MachineEntry = CollectionEntry<'machines'>;

const pictures = import.meta.glob<string>('../../../../content/machines/*/picture.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
});

/** The topic's picture (no words), ready to put inline: no extra request, works offline. */
export function picture(id: string): string | undefined {
  const svg = pictures[`../../../../content/machines/${id}/picture.svg`];
  return svg?.replace(/<\?xml[^>]*\?>\s*/, '').trim();
}

export async function getMachines(): Promise<MachineEntry[]> {
  const all = await getCollection('machines');
  const lessons = await getCollection('lessons');
  const problems: string[] = [];
  for (const topic of all) {
    if (topic.data.id !== topic.id) {
      problems.push(`${topic.id}: front matter id "${topic.data.id}" must match the folder name`);
    }
    for (const p of checkSections(topic.body ?? '')) problems.push(`${topic.id}: ${p}`);
    if (!picture(topic.id)) {
      problems.push(`${topic.id}: picture.svg not found in content/machines/${topic.id}/`);
    }
  }
  problems.push(
    ...linkProblems(
      all.map((t) => t.data),
      new Set(lessons.map((l) => l.id))
    )
  );
  const ids = new Set(all.map((t) => t.id));
  for (const lesson of lessons) {
    for (const id of lesson.data.machines) {
      if (!ids.has(id)) {
        problems.push(`${lesson.id}: machine "${id}" not found in content/machines/`);
      }
    }
  }
  // Topic translations are checked with the topics (machines spec FR-10).
  await getMachineTranslations();
  if (problems.length > 0) {
    throw new Error(`Machines problems:\n- ${problems.join('\n- ')}`);
  }
  const family = (f: MachineFamily) => MACHINE_FAMILIES.indexOf(f);
  return (
    all
      // Withdrawn topics (content/site/withdrawn.json) leave production; lessons naming one simply
      // leave it out of their "Parts in this robot" strip.
      .filter((t) => isVisible(t.data, showDrafts) && !hidden('machine', t.id))
      .sort(
        (a, b) =>
          family(a.data.family) - family(b.data.family) || a.data.title.localeCompare(b.data.title)
      )
  );
}
