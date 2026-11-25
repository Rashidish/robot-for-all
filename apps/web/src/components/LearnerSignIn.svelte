<script lang="ts">
  // Learner sign-in on a shared phone (M5 step 5a, ADR-0013): "Who's using this phone?" lists
  // learners already signed in here; anyone else types the class code, taps their nickname and
  // their four secret pictures. The first time (or after a reset) they choose the pictures and
  // repeat them. Nothing to type but the class code; no names, only nicknames.
  import { onMount } from 'svelte';
  import { AVATARS } from '../account/enrol';
  import {
    browserStore,
    cleanCode,
    type LearnerSession,
    liveSessions,
    PIN_PICTURES,
    setCurrentLearner,
    validCode
  } from '../learner/sessions';

  interface Props {
    labels: Record<string, string>;
  }
  let { labels }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';

  type Step = 'loading' | 'who' | 'code' | 'pick' | 'pin' | 'choose' | 'confirm' | 'locked';
  let step = $state<Step>('loading');
  let saved = $state<LearnerSession[]>([]);
  let code = $state('');
  let roster = $state<{ learner_id: string; nickname: string; avatar: string }[]>([]);
  let chosen = $state<{ learner_id: string; nickname: string; avatar: string } | null>(null);
  let pin = $state<number[]>([]);
  let firstChoice: number[] = [];
  let busy = $state(false);
  let message = $state('');
  const store = browserStore();

  onMount(async () => {
    saved = await liveSessions(store, Date.now() / 1000);
    step = saved.length ? 'who' : 'code';
  });

  const goToMe = (id: string) => {
    setCurrentLearner(sessionStorage, id, Date.now());
    location.href = '/me/';
  };

  async function call<T>(path: string, body: Record<string, unknown>) {
    const res = await fetch(`/signin/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  async function run(work: () => Promise<void>) {
    if (!navigator.onLine) {
      message = t('learner_offline');
      return;
    }
    busy = true;
    message = '';
    try {
      await work();
    } catch {
      message = t('learner_error');
    } finally {
      busy = false;
    }
  }

  const findClass = (e: SubmitEvent) => {
    e.preventDefault();
    const c = cleanCode(code);
    if (!validCode(c)) {
      message = t('learner_code_wrong');
      return;
    }
    return run(async () => {
      const r = await call<{ learners: typeof roster }>('roster', { class_code: c });
      if (r.status === 429) message = t('learner_slow_down');
      else if (r.status !== 200 || r.body.learners.length === 0) message = t('learner_code_wrong');
      else {
        roster = r.body.learners;
        step = 'pick';
      }
    });
  };

  const pick = (l: (typeof roster)[number]) => {
    chosen = l;
    pin = [];
    step = 'pin';
  };

  async function send(choose: boolean) {
    if (!chosen) return;
    const r = await call<{
      token: string;
      expires_at: number;
      learner: { id: string; nickname: string; avatar: string };
    }>('pin', { class_code: cleanCode(code), learner: chosen.learner_id, pin, choose });
    pin = [];
    if (r.status === 200) {
      await store.put({
        learnerId: r.body.learner.id,
        nickname: r.body.learner.nickname,
        avatar: r.body.learner.avatar,
        token: r.body.token,
        expiresAt: r.body.expires_at
      });
      goToMe(r.body.learner.id);
    } else if (r.status === 409) {
      step = 'choose';
      message = t('learner_choose_first');
    } else if (r.status === 423) step = 'locked';
    else if (r.status === 401) message = t('learner_pin_wrong');
    else if (r.status === 429) message = t('learner_slow_down');
    else message = t('learner_error');
  }

  const tap = (n: number) => {
    if (busy || pin.length >= 4) return;
    pin = [...pin, n];
    if (pin.length < 4) return;
    if (step === 'pin') return run(() => send(false));
    if (step === 'choose') {
      firstChoice = pin;
      pin = [];
      step = 'confirm';
      message = t('learner_choose_again');
    } else if (step === 'confirm') {
      if (pin.join() === firstChoice.join()) return run(() => send(true));
      pin = [];
      firstChoice = [];
      step = 'choose';
      message = t('learner_choose_mismatch');
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (!['pin', 'choose', 'confirm'].includes(step)) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) tap(n - 1);
    if (e.key === 'Backspace') pin = pin.slice(0, -1);
  };
</script>

<svelte:window onkeydown={onKey} />

<div class="learner" aria-live="polite">
  {#if step === 'loading'}
    <p>{t('learner_loading')}</p>
  {:else if step === 'who'}
    <h2>{t('learner_who')}</h2>
    <ul class="people">
      {#each saved as s (s.learnerId)}
        <li>
          <button type="button" class="person" onclick={() => goToMe(s.learnerId)}>
            <span aria-hidden="true">{emoji(s.avatar)}</span>
            {s.nickname}
          </button>
        </li>
      {/each}
    </ul>
    <button type="button" class="button" onclick={() => (step = 'code')}>
      {t('learner_someone_else')}
    </button>
  {:else if step === 'code'}
    <form onsubmit={findClass}>
      <label for="class-code">{t('learner_code')}</label>
      <input
        id="class-code"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="9"
        required
        bind:value={code}
      />
      <button class="button" type="submit" disabled={busy}>{t('learner_next')}</button>
    </form>
  {:else if step === 'pick'}
    <h2>{t('learner_pick')}</h2>
    <ul class="people">
      {#each roster as l (l.learner_id)}
        <li>
          <button type="button" class="person" onclick={() => pick(l)}>
            <span aria-hidden="true">{emoji(l.avatar)}</span>
            {l.nickname}
          </button>
        </li>
      {/each}
    </ul>
  {:else if step === 'locked'}
    <p>{t('learner_locked')}</p>
    <button type="button" class="button" onclick={() => (step = 'pick')}>
      {t('learner_back')}
    </button>
  {:else}
    <h2>
      {#if chosen}<span aria-hidden="true">{emoji(chosen.avatar)}</span> {chosen.nickname}:{/if}
      {step === 'pin'
        ? t('learner_pin')
        : step === 'choose'
          ? t('learner_choose')
          : t('learner_repeat')}
    </h2>
    <p class="dots" aria-label={`${pin.length} / 4`}>
      {#each [0, 1, 2, 3] as i (i)}<span class:on={i < pin.length}></span>{/each}
    </p>
    <div class="pad" role="group" aria-label={t('learner_pad')}>
      {#each PIN_PICTURES as p, i (p.id)}
        <button
          type="button"
          class="pic"
          disabled={busy}
          onclick={() => tap(i)}
          aria-label={t(`learner_pic_${p.id}`)}
        >
          <span aria-hidden="true">{p.emoji}</span>
        </button>
      {/each}
    </div>
    <p class="actions">
      <button type="button" class="plain" onclick={() => (pin = [])}>
        {t('learner_start_again')}
      </button>
      <button type="button" class="plain" onclick={() => (step = 'pick')}>
        {t('learner_not_me')}
      </button>
    </p>
  {/if}
  {#if message}<p class="message" role="status">{message}</p>{/if}
</div>

<style>
  .learner form {
    display: grid;
    gap: var(--space-2);
    max-width: 20rem;
  }
  .learner input {
    font: inherit;
    font-size: 1.5rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 0.6rem;
    min-height: 48px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 48px;
    cursor: pointer;
  }
  .people {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-2);
  }
  .person {
    width: 100%;
    min-height: 56px;
    font: inherit;
    font-weight: 600;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .person span {
    font-size: 1.6rem;
  }
  .pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
    max-width: 18rem;
  }
  .pic {
    aspect-ratio: 1;
    min-height: 72px;
    font-size: 2.2rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    cursor: pointer;
  }
  .dots {
    display: flex;
    gap: 0.6rem;
  }
  .dots span {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 2px solid var(--color-text);
  }
  .dots span.on {
    background: var(--color-text);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }
</style>
