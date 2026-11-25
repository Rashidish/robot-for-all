// Starts the learner islands (loaded on demand): sign-in on /class/, the learner's page on /me/.
import { mount } from 'svelte';
import LearnerSignIn from '../components/LearnerSignIn.svelte';
import Me from '../components/Me.svelte';

export function start(target: HTMLElement, which: 'signin' | 'me', labels: Record<string, string>) {
  target.replaceChildren();
  mount(which === 'signin' ? LearnerSignIn : Me, { target, props: { labels } });
}
