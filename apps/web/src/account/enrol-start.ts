// Starts the enrolment form on /enrol/ (loaded on demand).
import { mount } from 'svelte';
import Enrol from '../components/Enrol.svelte';

export function start(
  target: HTMLElement,
  labels: Record<string, string>,
  languages: { code: string; native: string }[]
): void {
  target.replaceChildren();
  mount(Enrol, { target, props: { labels, languages } });
}
