// Starts the account panel on /account/ (loaded on demand, like the code editor).
import { mount } from 'svelte';
import Account from '../components/Account.svelte';

export function start(
  target: HTMLElement,
  labels: Record<string, string>,
  languages: { code: string; native: string }[],
  helper = false
): void {
  target.replaceChildren();
  mount(Account, { target, props: { labels, languages, helper } });
}
