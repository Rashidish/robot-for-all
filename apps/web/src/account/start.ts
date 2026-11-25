// Starts the account panel on /account/ (loaded on demand, like the code editor).
import { mount } from 'svelte';
import Account from '../components/Account.svelte';

export function start(target: HTMLElement, labels: Record<string, string>): void {
  target.replaceChildren();
  mount(Account, { target, props: { labels } });
}
