// Loads the Machines topics (machines spec §6) and enforces the rules that need the body, the
// folder or the lessons. A broken topic, or a lesson naming a missing one, fails the build.
import { getCollection, type CollectionEntry } from 'astro:content';
import { showDrafts } from '../lessons/load';
import { isVisible } from '../lessons/schema';
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
  if (problems.length > 0) {
    throw new Error(`Machines problems:\n- ${problems.join('\n- ')}`);
  }
  const family = (f: MachineFamily) => MACHINE_FAMILIES.indexOf(f);
  return all
    .filter((t) => isVisible(t.data, showDrafts))
    .sort(
      (a, b) =>
        family(a.data.family) - family(b.data.family) || a.data.title.localeCompare(b.data.title)
    );
}
