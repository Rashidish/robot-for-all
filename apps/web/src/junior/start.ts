// Starts Junior on /code/junior/ (loaded as a module script, like the code editor).
import { mount } from 'svelte';
import Junior from '../components/Junior.svelte';
import type { Mission } from '../../../../packages/sim/src/junior';

export function start(
  target: HTMLElement,
  labels: Record<string, string>,
  missions: Mission[],
  language: string
): void {
  target.replaceChildren();
  mount(Junior, { target, props: { labels, missions, language } });
}
