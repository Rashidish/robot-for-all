<script lang="ts">
  // A parent confirms a school's or club's enrolment (M5 step 4b, FR-5a). The link in their
  // email, /enrol/confirm/#<secret>, works only for the email address the school gave. They read
  // what is kept, give consent and choose the nickname; the name the school typed is kept for
  // certificates only if they tick that (consent b). Nothing is recorded before they confirm.
  import { onMount } from 'svelte';
  import { AccountError, type AccountClient, browserClient } from '../account/client';
  import { AVATARS, childProblems, NOTICE_VERSION } from '../account/enrol';

  interface Props {
    labels: Record<string, string>;
    languages: { code: string; native: string }[];
  }
  let { labels, languages }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  let client: AccountClient | undefined;
  let token: string | null = null;
  type Step =
    'loading' | 'bad-link' | 'expired' | 'other-email' | 'email' | 'code' | 'form' | 'done';
  let step = $state<Step>('loading');
  let email = $state('');
  let code = $state('');
  let busy = $state(false);
  let error = $state('');
  let where = $state<{ class_name: string; organisation_name: string; grade: number } | null>(null);
  let children = $state<{ id: string; nickname: string }[]>([]);
  let which = $state('new');
  let nickname = $state('');
  let avatar = $state('robot');
  let language = $state(languages[0]?.code ?? 'en');
  let guardian = $state(false);
  let record = $state(false);
  let share = $state(false);
  let keepName = $state(false);
  let enrolledAs = $state('');

  async function open() {
    try {
      where = await (client as AccountClient).cert('pending', { token });
      children =
        (await client?.select<{ id: string; nickname: string }>('learners', 'id,nickname')) ?? [];
      step = 'form';
    } catch (err) {
      if (err instanceof AccountError && err.status === 403) step = 'other-email';
      else if (err instanceof AccountError && err.status === 404) step = 'expired';
      else if (err instanceof AccountError && err.status === 401) step = 'email';
      else error = t('account_error');
    }
  }

  onMount(async () => {
    token = /^#([0-9a-f]{64})$/.exec(location.hash)?.[1] ?? null;
    if (!token) {
      step = 'bad-link';
      return;
    }
    client = browserClient();
    try {
      if (await client.session()) await open();
      else step = 'email';
    } catch {
      step = 'email';
    }
  });

  async function run(work: () => Promise<void>) {
    if (!navigator.onLine) {
      error = t('account_offline');
      return;
    }
    busy = true;
    error = '';
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
    });
  };
  const signIn = (e: SubmitEvent) => {
    e.preventDefault();
    return run(async () => {
      await client?.verifyCode(email, code);
      await client?.rpc('touch_adult', {});
      await open();
    });
  };
  const useOtherEmail = () =>
    run(async () => {
      await client?.signOut();
      step = 'email';
    });

  const confirm = (e: SubmitEvent) => {
    e.preventDefault();
    if (which === 'new') {
      const problems = childProblems({ nickname, grade: where?.grade ?? 0 });
      if (problems.length) {
        error = problems.map(t).join(' ');
        return;
      }
    }
    return run(async () => {
      await client?.cert('confirm', {
        token,
        notice: NOTICE_VERSION,
        keep_name: keepName,
        ...(which === 'new' ? { nickname: nickname.trim(), avatar, language } : { existing: which })
      });
      enrolledAs =
        which === 'new' ? nickname.trim() : (children.find((c) => c.id === which)?.nickname ?? '');
      history.replaceState(null, '', location.pathname);
      step = 'done';
    });
  };
</script>

<div class="confirm" aria-live="polite">
  {#if step === 'loading'}
    <p>{t('account_loading')}</p>
  {:else if step === 'bad-link'}
    <p>{t('confirm_bad_link')}</p>
  {:else if step === 'expired'}
    <p>{t('confirm_expired')}</p>
  {:else if step === 'other-email'}
    <p>{t('confirm_other_email')}</p>
    <button class="button" type="button" disabled={busy} onclick={useOtherEmail}>
      {t('confirm_use_other_email')}
    </button>
  {:else if step === 'email'}
    <p>{t('confirm_sign_in_first')}</p>
    <form onsubmit={sendCode}>
      <label for="confirm-email">{t('account_email')}</label>
      <input id="confirm-email" type="email" autocomplete="email" required bind:value={email} />
      <button class="button" type="submit" disabled={busy}>{t('account_send_code')}</button>
    </form>
  {:else if step === 'code'}
    <form onsubmit={signIn}>
      <label for="confirm-code">{t('account_code')}</label>
      <input
        id="confirm-code"
        inputmode="numeric"
        autocomplete="one-time-code"
        required
        bind:value={code}
      />
      <button class="button" type="submit" disabled={busy}>{t('account_sign_in')}</button>
    </form>
  {:else if step === 'form' && where}
    <p class="who">
      <strong>{where.organisation_name}</strong>
      {t('confirm_asked')}
      <strong>{where.class_name}</strong> ({t('enrol_grade')}
      {where.grade}).
    </p>
    <form onsubmit={confirm}>
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
        <label for="confirm-nickname">{t('enrol_nickname')}</label>
        <input id="confirm-nickname" required minlength="2" maxlength="20" bind:value={nickname} />
        <p class="muted">{t('enrol_nickname_hint')}</p>
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
        <label for="confirm-language">{t('account_class_language')}</label>
        <select id="confirm-language" bind:value={language}>
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
        <label class="check">
          <input type="checkbox" bind:checked={keepName} />
          {t('confirm_keep_name')}
        </label>
      </fieldset>
      <button class="button" type="submit" disabled={busy || !guardian || !record || !share}>
        {t('confirm_submit')}
      </button>
    </form>
  {:else if step === 'done'}
    <p><strong>{t('enrol_done')}</strong> {enrolledAs}</p>
    <p>{t('enrol_done_next')}</p>
    <p><a href="/account/">{t('account_title')}</a></p>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .confirm form {
    display: grid;
    gap: var(--space-2);
    max-width: 28rem;
    margin-block: var(--space-4);
  }
  .confirm input:not([type='radio'], [type='checkbox']),
  .confirm select {
    font: inherit;
    padding: 0.6rem;
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .confirm .button {
    border: 0;
    justify-content: center;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .confirm .button:disabled {
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
