// Starts the parent's confirmation form on /enrol/confirm/ (loaded on demand).
import { mount } from 'svelte';
import Confirm from '../components/Confirm.svelte';

export function start(
  target: HTMLElement,
  labels: Record<string, string>,
  languages: { code: string; native: string }[]
): void {
  target.replaceChildren();
  mount(Confirm, { target, props: { labels, languages } });
}
