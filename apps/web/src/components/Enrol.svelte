<script lang="ts">
  // Enrol your child (M5 step 4a, spec FR-5 to FR-10): a parent or guardian signs in with an
  // emailed code, reads what is kept and why, gives consent, and enrols their child by
  // nickname, or adds a child they already enrolled elsewhere (one profile per child, FR-5b).
  // The database checks every rule; nothing is recorded before consent.
  import { onMount } from 'svelte';
  import { type AccountClient, browserClient } from '../account/client';
  import { AVATARS, childProblems, enrolTokenFromHash, NOTICE_VERSION } from '../account/enrol';

  interface Props {
    labels: Record<string, string>;
    languages: { code: string; native: string }[];
  }
  let { labels, languages }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  let client: AccountClient | undefined;
  let token: string | null = null;
  let step = $state<'loading' | 'bad-link' | 'email' | 'code' | 'form' | 'done'>('loading');
  let email = $state('');
  let code = $state('');
  let busy = $state(false);
  let error = $state('');
  let message = $state('');

  let children = $state<{ id: string; nickname: string }[]>([]);
  let which = $state('new');
  let nickname = $state('');
  let grade = $state(4);
  let avatar = $state('robot');
  let language = $state(languages[0]?.code ?? 'en');
  let guardian = $state(false);
  let record = $state(false);
  let share = $state(false);
  let enrolledAs = $state('');

  onMount(async () => {
    token = enrolTokenFromHash(location.hash);
    if (!token) {
      step = 'bad-link';
      return;
    }
    client = browserClient();
    try {
      step = (await client.session()) ? 'form' : 'email';
      if (step === 'form') await loadChildren();
    } catch {
      step = 'email';
    }
  });

  async function loadChildren() {
    children =
      (await client?.select<{ id: string; nickname: string }>('learners', 'id,nickname')) ?? [];
  }

  async function run(work: () => Promise<void>) {
    if (!navigator.onLine) {
      error = t('account_offline');
      return;
    }
    busy = true;
    error = '';
    message = '';
    try {
      await work();
    } catch (err) {
      error = err instanceof Error && err.message ? err.message : t('account_error');
    } finally {
      busy = false;
    }
  }

  const sendCode = (e: SubmitEvent) => {
    e.preventDefault();
    return run(async () => {
      await client?.requestCode(email);
      step = 'code';
      message = t('account_code_sent');
    });
  };

  const signIn = (e: SubmitEvent) => {
    e.preventDefault();
    return run(async () => {
      await client?.verifyCode(email, code);
      await client?.rpc('touch_adult', {});
      await loadChildren();
      step = 'form';
    });
  };

  const enrol = (e: SubmitEvent) => {
    e.preventDefault();
    if (which === 'new') {
      const problems = childProblems({ nickname, grade });
      if (problems.length) {
        error = problems.map(t).join(' ');
        return;
      }
    }
    return run(async () => {
      if (which === 'new') {
        await client?.rpc('enrol_child', {
          p_enrol_token: token,
          p_nickname: nickname.trim(),
          p_grade: grade,
          p_avatar: avatar,
          p_language: language,
          p_notice: NOTICE_VERSION
        });
        enrolledAs = nickname.trim();
      } else {
        await client?.rpc('link_child', {
          p_enrol_token: token,
          p_learner: which,
          p_notice: NOTICE_VERSION
        });
        enrolledAs = children.find((c) => c.id === which)?.nickname ?? '';
      }
      // The class token leaves the address once used.
      history.replaceState(null, '', location.pathname);
      step = 'done';
    });
  };
</script>

<div class="enrol" aria-live="polite">
  {#if step === 'loading'}
    <p>{t('account_loading')}</p>
  {:else if step === 'bad-link'}
    <p>{t('enrol_bad_link')}</p>
  {:else if step === 'email'}
    <p>{t('enrol_sign_in_first')}</p>
    <form onsubmit={sendCode}>
      <label for="enrol-email">{t('account_email')}</label>
      <input id="enrol-email" type="email" autocomplete="email" required bind:value={email} />
      <button class="button" type="submit" disabled={busy}>{t('account_send_code')}</button>
    </form>
  {:else if step === 'code'}
    <form onsubmit={signIn}>
      <label for="enrol-code">{t('account_code')}</label>
      <input
        id="enrol-code"
        inputmode="numeric"
        autocomplete="one-time-code"
        required
        bind:value={code}
      />
      <button class="button" type="submit" disabled={busy}>{t('account_sign_in')}</button>
    </form>
  {:else if step === 'form'}
    <form onsubmit={enrol}>
      <section aria-labelledby="notice-title" class="notice">
        <h2 id="notice-title">{t('enrol_notice_title')}</h2>
        <ul>
          <li>{t('enrol_notice_kept')}</li>
          <li>{t('enrol_notice_not_kept')}</li>
          <li>{t('enrol_notice_who')}</li>
          <li>{t('enrol_notice_why')}</li>
          <li>{t('enrol_notice_withdraw')}</li>
        </ul>
      </section>

      {#if children.length > 0}
        <fieldset>
          <legend>{t('enrol_which_child')}</legend>
          {#each children as c (c.id)}
            <label class="check">
              <input type="radio" name="which" value={c.id} bind:group={which} />
              {c.nickname}
            </label>
          {/each}
          <label class="check">
            <input type="radio" name="which" value="new" bind:group={which} />
            {t('enrol_new_child')}
          </label>
        </fieldset>
      {/if}

      {#if which === 'new'}
        <label for="enrol-nickname">{t('enrol_nickname')}</label>
        <input id="enrol-nickname" required minlength="2" maxlength="20" bind:value={nickname} />
        <p class="muted">{t('enrol_nickname_hint')}</p>
        <label for="enrol-grade">{t('enrol_grade')}</label>
        <select id="enrol-grade" bind:value={grade}>
          {#each Array.from({ length: 12 }, (_, i) => i + 1) as g (g)}<option value={g}>
              {g}
            </option>{/each}
        </select>
        <fieldset>
          <legend>{t('enrol_avatar')}</legend>
          <div class="avatars">
            {#each AVATARS as a (a.id)}
              <label class="avatar">
                <input type="radio" name="avatar" value={a.id} bind:group={avatar} />
                <span aria-hidden="true">{a.emoji}</span>
                <span class="visually-hidden">{t(`enrol_avatar_${a.id}`)}</span>
              </label>
            {/each}
          </div>
        </fieldset>
        <label for="enrol-language">{t('account_class_language')}</label>
        <select id="enrol-language" bind:value={language}>
          {#each languages as l (l.code)}<option value={l.code}>{l.native}</option>{/each}
        </select>
      {/if}

      <fieldset>
        <legend>{t('enrol_consent_title')}</legend>
        <label class="check">
          <input type="checkbox" required bind:checked={guardian} />
          {t('enrol_consent_guardian')}
        </label>
        <label class="check">
          <input type="checkbox" required bind:checked={record} />
          {t('enrol_consent_record')}
        </label>
        <label class="check">
          <input type="checkbox" required bind:checked={share} />
          {t('enrol_consent_class')}
        </label>
      </fieldset>
      <p class="muted">{t('enrol_name_later')}</p>
      <button class="button" type="submit" disabled={busy || !guardian || !record || !share}>
        {t('enrol_submit')}
      </button>
    </form>
  {:else}
    <p><strong>{t('enrol_done')}</strong> {enrolledAs}</p>
    <p>{t('enrol_done_next')}</p>
    <p><a href="/account/">{t('account_title')}</a></p>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .enrol form {
    display: grid;
    gap: var(--space-2);
    max-width: 28rem;
    margin-block: var(--space-4);
  }
  .enrol input:not([type='radio'], [type='checkbox']),
  .enrol select {
    font: inherit;
    padding: 0.6rem;
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .enrol .button {
    border: 0;
    justify-content: center;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .enrol .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .notice {
    padding: var(--space-2) var(--space-4);
    border-left: 4px solid var(--color-accent);
    background: var(--color-surface);
  }
  .check {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    min-height: 44px;
    padding-block: 0.5rem;
  }
  .avatars {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .avatar {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    min-height: 44px;
    min-width: 44px;
    font-size: 1.5rem;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
</style>
