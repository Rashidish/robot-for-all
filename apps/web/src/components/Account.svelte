<script lang="ts">
  // Your account (M5 step 3b): sign in with a one-time code by email, set the name others see,
  // sign out. Learners don't need an account for lessons, templates or the code editor.
  import { onMount } from 'svelte';
  import { type AccountClient, browserClient } from '../account/client';
  import Children from './Children.svelte';
  import Organisations from './Organisations.svelte';
  import { inviteFromHash } from '../account/classes';

  interface Props {
    labels: Record<string, string>;
    languages: { code: string; native: string }[];
  }
  let { labels, languages }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  let client: AccountClient | undefined;
  let step = $state<'loading' | 'email' | 'code' | 'signed-in'>('loading');
  let email = $state('');
  let code = $state('');
  let displayName = $state('');
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  onMount(async () => {
    client = browserClient();
    // An invitation link opened while this page is already open changes only the # part.
    window.addEventListener('hashchange', () => {
      if (step === 'signed-in') void acceptInvite();
    });
    try {
      const s = await client.session();
      step = s ? 'signed-in' : 'email';
      if (s) {
        await acceptInvite();
        await loadName();
      }
    } catch {
      step = 'email';
    }
  });

  /** A colleague's invitation link (#invite=…): joined once signed in (M5 step 3d). */
  let joined = $state(false);
  async function acceptInvite() {
    const token = inviteFromHash(location.hash);
    if (!token || !client) return;
    history.replaceState(null, '', location.pathname);
    try {
      await client.rpc('accept_staff_invitation', { p_token: token });
      joined = true;
      message = t('account_staff_joined');
    } catch (err) {
      error = err instanceof Error && err.message ? err.message : t('account_error');
    }
  }

  async function loadName() {
    const rows = await client?.select<{ display_name: string }>('adults', 'display_name');
    displayName = rows?.[0]?.display_name ?? '';
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
    } catch {
      error = t('account_error');
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
      // Creates the account's row and stops any dormancy countdown (M5 spec §7.5).
      await client?.rpc('touch_adult', {});
      await acceptInvite();
      await loadName();
      code = '';
      step = 'signed-in';
    });
  };

  const saveName = (e: SubmitEvent) => {
    e.preventDefault();
    return run(async () => {
      await client?.rpc('touch_adult', { p_display_name: displayName });
      message = t('account_saved');
    });
  };

  const signOut = () =>
    run(async () => {
      await client?.signOut();
      step = 'email';
      displayName = '';
    });
</script>

<div class="account" aria-live="polite">
  {#if step === 'loading'}
    <p>{t('account_loading')}</p>
  {:else if step === 'email'}
    <form onsubmit={sendCode}>
      <label for="account-email">{t('account_email')}</label>
      <input id="account-email" type="email" autocomplete="email" required bind:value={email} />
      <button class="button" type="submit" disabled={busy}>{t('account_send_code')}</button>
    </form>
  {:else if step === 'code'}
    <form onsubmit={signIn}>
      <label for="account-code">{t('account_code')}</label>
      <input
        id="account-code"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern={'[0-9 ]{6,8}'}
        required
        bind:value={code}
      />
      <button class="button" type="submit" disabled={busy}>{t('account_sign_in')}</button>
      <button type="button" class="plain" onclick={() => (step = 'email')}>
        {t('account_other_email')}
      </button>
    </form>
  {:else}
    <p><strong>{t('account_signed_in')}</strong></p>
    <form onsubmit={saveName}>
      <label for="account-name">{t('account_display_name')}</label>
      <input id="account-name" maxlength="60" minlength="2" required bind:value={displayName} />
      <button class="button" type="submit" disabled={busy}>{t('account_save')}</button>
    </form>
    <p><button type="button" class="plain" onclick={signOut}>{t('account_sign_out')}</button></p>
    {#if client}
      <Children {client} {labels} />
      {#key joined}<Organisations {client} {labels} {languages} />{/key}
    {/if}
  {/if}
  {#if message}<p class="message" role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .account form {
    display: grid;
    gap: var(--space-2);
    max-width: 24rem;
    margin-block: var(--space-4);
  }
  .account input {
    font: inherit;
    padding: 0.6rem;
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .account button {
    min-height: 44px;
    font: inherit;
    cursor: pointer;
  }
  .account .button {
    border: 0;
    justify-content: center;
    font-weight: 600;
  }
  .account .plain {
    border: 0;
    background: none;
    color: var(--color-link, inherit);
    text-decoration: underline;
    padding: 0;
    justify-self: start;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
</style>
