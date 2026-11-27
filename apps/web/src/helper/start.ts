// Starts the helper panel when someone taps "Ask the helper" (loaded on demand: lesson pages carry
// no helper code until then; CLAUDE.md §9.6).
import { mount } from 'svelte';
import Helper from '../components/Helper.svelte';

export function start(
  target: HTMLElement,
  labels: Record<string, string>,
  lesson: string | null,
  language: string
): void {
  target.replaceChildren();
  mount(Helper, { target, props: { labels, lesson, language } });
}
