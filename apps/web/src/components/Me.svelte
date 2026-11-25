<script lang="ts">
  // The learner's own page (M5 step 5a): who is signed in on this phone right now. Records come
  // in step 5b. After 10 idle minutes the phone forgets who is using it; the learner taps their
  // name again (no PIN for 30 days on this phone). "Remove me from this phone" ends the session.
  import { onMount } from 'svelte';
  import { AVATARS } from '../account/enrol';
  import {
    browserStore,
    clearCurrentLearner,
    currentLearner,
    type LearnerSession,
    liveSessions,
    setCurrentLearner
  } from '../learner/sessions';

  interface Props {
    labels: Record<string, string>;
  }
  let { labels }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';
  const store = browserStore();
  let me = $state<LearnerSession | null>(null);
  let ready = $state(false);

  const leave = () => {
    clearCurrentLearner(sessionStorage);
    location.href = '/class/';
  };

  onMount(() => {
    void (async () => {
      const id = currentLearner(sessionStorage, Date.now());
      me = (await liveSessions(store, Date.now() / 1000)).find((s) => s.learnerId === id) ?? null;
      ready = true;
    })();
    // Any tap or key keeps the phone with this learner; 10 quiet minutes and it forgets.
    const touch = () => me && setCurrentLearner(sessionStorage, me.learnerId, Date.now());
    const check = setInterval(() => {
      if (me && currentLearner(sessionStorage, Date.now()) === null) leave();
    }, 30_000);
    addEventListener('pointerdown', touch);
    addEventListener('keydown', touch);
    return () => {
      clearInterval(check);
      removeEventListener('pointerdown', touch);
      removeEventListener('keydown', touch);
    };
  });

  const removeMe = async () => {
    if (!me) return;
    await store.remove(me.learnerId);
    leave();
  };
</script>

<div class="me" aria-live="polite">
  {#if !ready}
    <p>{t('learner_loading')}</p>
  {:else if !me}
    <p>{t('learner_who_first')}</p>
    <p><a class="button" href="/class/">{t('learner_sign_in')}</a></p>
  {:else}
    <h2><span aria-hidden="true">{emoji(me.avatar)}</span> {t('learner_hello')} {me.nickname}</h2>
    <p>{t('learner_signed_in_here')}</p>
    <p class="muted">{t('learner_records_soon')}</p>
    <p class="muted">{t('learner_idle_note')}</p>
    <p class="actions">
      <button type="button" class="button" onclick={leave}>{t('learner_done')}</button>
      <button type="button" class="plain" onclick={removeMe}>{t('learner_remove')}</button>
    </p>
  {/if}
</div>

<style>
  .me h2 span {
    font-size: 2rem;
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 48px;
    cursor: pointer;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
  }
</style>
