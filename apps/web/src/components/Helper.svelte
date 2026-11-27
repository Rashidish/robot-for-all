<script lang="ts">
  // "Ask the helper" (M6 spec §3, FR-1 to FR-5): on a lesson page, its Common questions (offline
  // once seen) and, for a signed-in adult or a child whose parent allowed it, a question box. On an
  // adult's home page, the question box only. Nothing typed is kept: the question and answer live
  // in this panel and are gone when the page closes. Every answer carries the AI disclaimer.
  import { onMount } from 'svelte';
  import {
    type Asker,
    browserAsker,
    type FaqItem,
    helperClient,
    statusKey
  } from '../helper/client';

  interface Props {
    labels: Record<string, string>;
    lesson: string | null;
    language: string;
  }
  let { labels, lesson, language }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const client = helperClient();

  let asker = $state<Asker | undefined>(undefined);
  let faq = $state<FaqItem[]>([]);
  let faqLoaded = $state(false);
  let hiddenItems = $state<number[]>([]);
  let downed = $state<number[]>([]);
  let question = $state('');
  let busy = $state(false);
  let answer = $state('');
  let status = $state('');
  let earlier = $state<{ question: string; answer: string } | null>(null);
  let followUpUsed = $state(false);
  let thumbed = $state(false);
  let online = $state(true);

  const max = $derived(asker?.kind === 'child' ? 200 : 500);
  const canAsk = $derived(
    asker !== undefined && asker !== null && (asker.kind === 'adult' || lesson !== null)
  );

  onMount(() => {
    online = navigator.onLine;
    const update = () => (online = navigator.onLine);
    addEventListener('online', update);
    addEventListener('offline', update);
    browserAsker()
      .then((a) => (asker = a))
      .catch(() => (asker = null));
    if (lesson) {
      client
        .faq(lesson, language)
        .then((items) => (faq = items))
        .finally(() => (faqLoaded = true));
    }
    return () => {
      removeEventListener('online', update);
      removeEventListener('offline', update);
    };
  });

  async function ask(e: SubmitEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || !asker || busy) return;
    busy = true;
    status = '';
    const previous = earlier;
    const reply = await client.ask(asker.token, {
      question: q,
      page: lesson ? 'lesson' : 'home',
      ...(lesson ? { lesson } : {}),
      language,
      ...(previous ? { earlier: previous } : {})
    });
    busy = false;
    if (reply.status === 'ok' && reply.answer) {
      if (answer) followUpUsed = true;
      earlier = { question: q, answer: reply.answer };
      answer = reply.answer;
      question = '';
      thumbed = false;
    } else {
      status = reply.status;
    }
  }

  async function thumb(up: boolean) {
    if (!asker || thumbed) return;
    thumbed = true;
    await client.thumb(asker.token, up);
  }

  async function down(item: number) {
    if (!asker || !lesson || downed.includes(item)) return;
    downed = [...downed, item];
    if (await client.faqDown(asker.token, lesson, language, item)) {
      hiddenItems = [...hiddenItems, item];
    }
  }
</script>

<section class="helper" aria-labelledby="helper-title">
  <h2 id="helper-title">{t('helper_title')}</h2>

  {#if lesson}
    <h3>{t('helper_faq_title')}</h3>
    {#if !faqLoaded}
      <p class="muted">{t('helper_loading')}</p>
    {:else if faq.filter((f) => !hiddenItems.includes(f.item)).length === 0}
      <p class="muted">{t('helper_faq_none')}</p>
    {:else}
      <p class="disclaimer">{t('helper_disclaimer')}</p>
      {#each faq.filter((f) => !hiddenItems.includes(f.item)) as f (f.item)}
        <details>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
          {#if asker}
            <button
              type="button"
              class="plain"
              disabled={downed.includes(f.item)}
              onclick={() => down(f.item)}
            >
              {downed.includes(f.item) ? t('helper_thanks') : `👎 ${t('helper_wrong')}`}
            </button>
          {/if}
        </details>
      {/each}
    {/if}
  {/if}

  {#if asker === undefined}
    <p class="muted">{t('helper_loading')}</p>
  {:else if asker === null}
    <p>
      {t('helper_sign_in')}
      <a href="/account/">{t('helper_sign_in_adult')}</a> ·
      <a href="/class/">{t('helper_sign_in_learner')}</a>
    </p>
  {:else if canAsk}
    {#if answer}
      <div class="answer" aria-live="polite">
        <p>{answer}</p>
        <p class="disclaimer">
          {t('helper_disclaimer')}
          {#if asker.kind === 'child'}{t('helper_disclaimer_child')}{/if}
        </p>
        <p class="thumbs">
          {#if thumbed}
            <span>{t('helper_thanks')}</span>
          {:else}
            <button
              type="button"
              class="plain"
              aria-label={t('helper_helpful')}
              onclick={() => thumb(true)}
            >
              👍
            </button>
            <button
              type="button"
              class="plain"
              aria-label={t('helper_not_helpful')}
              onclick={() => thumb(false)}
            >
              👎
            </button>
          {/if}
        </p>
      </div>
    {/if}

    {#if !online}
      <p class="muted">{t('helper_offline')}</p>
    {:else if !followUpUsed}
      <form onsubmit={ask}>
        <label for="helper-question">{answer ? t('helper_follow_up') : t('helper_question')}</label>
        <textarea
          id="helper-question"
          rows="3"
          maxlength={max}
          bind:value={question}
          aria-describedby="helper-hint"></textarea>
        <p id="helper-hint" class="muted">
          {asker.kind === 'child' ? t('helper_hint_child') : t('helper_hint_adult')}
          ({question.length}/{max})
        </p>
        <button class="button" type="submit" disabled={busy || !question.trim()}>
          {busy ? t('helper_thinking') : t('helper_ask')}
        </button>
      </form>
    {:else}
      <p class="muted">{t('helper_one_follow_up')}</p>
    {/if}

    {#if status}
      <p class={status === 'safety' ? 'safety' : 'note'} role="status">{t(statusKey(status))}</p>
    {/if}
  {/if}
</section>

<style>
  .helper {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-3);
    margin-block: var(--space-4);
  }
  .helper h2 {
    margin-top: 0;
  }
  details {
    border-top: 1px solid var(--color-border);
    padding-block: var(--space-2);
  }
  summary {
    min-height: 44px;
    padding-block: 0.6rem;
    cursor: pointer;
    font-weight: 600;
  }
  form {
    display: grid;
    gap: var(--space-2);
    max-width: 32rem;
  }
  textarea {
    font: inherit;
    padding: 0.6rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    width: 100%;
    box-sizing: border-box;
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .plain {
    min-height: 44px;
    min-width: 44px;
  }
  .answer {
    background: var(--color-surface, transparent);
    border-left: 4px solid var(--color-accent, currentColor);
    padding-left: var(--space-2);
  }
  .disclaimer {
    font-size: 0.9rem;
    font-style: italic;
  }
  .safety {
    font-weight: 600;
    font-size: 1.1rem;
  }
  .thumbs {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
</style>
