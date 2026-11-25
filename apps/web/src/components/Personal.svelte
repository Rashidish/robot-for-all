<script lang="ts">
  // Learning myself (family and personal spec, step 3): an adult's own learner profile, in no
  // group. They confirm they're 18 or older (no birth date is kept) and give their own consent;
  // then "Start learning" opens My page without a class code or picture PIN. Their certificates
  // say "Awarded by Robots For All" unless they join a school or club class. Under 18? A parent
  // starts a family group instead.
  import { onMount } from 'svelte';
  import type { AccountClient } from '../account/client';
  import { AVATARS, NOTICE_VERSION } from '../account/enrol';
  import { learnAs } from '../learner/learn-as';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
    languages: { code: string; native: string }[];
  }
  let { client, labels, languages }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  let mine = $state<string | null | undefined>(undefined);
  let nickname = $state('');
  let avatar = $state('robot');
  let language = $state(languages[0]?.code ?? 'en');
  let adult = $state(false);
  let record = $state(false);
  let busy = $state(false);
  let error = $state('');

  onMount(async () => {
    try {
      mine = (await client.rpc<string | null>('my_personal_learner')) ?? null;
    } catch {
      mine = null;
    }
  });

  async function run(work: () => Promise<void>) {
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

  const create = (e: SubmitEvent) => {
    e.preventDefault();
    return run(async () => {
      mine = await client.rpc<string>('create_personal_learner', {
        p_nickname: nickname.trim(),
        p_avatar: avatar,
        p_language: language,
        p_notice: NOTICE_VERSION,
        p_adult: adult
      });
    });
  };

  const start = () =>
    run(async () => {
      if (mine && !(await learnAs(client, mine))) error = t('account_error');
    });

  const remove = () => {
    if (!mine || !confirm(t('personal_delete_confirm'))) return;
    return run(async () => {
      await client.rpc('delete_learner', { p_learner: mine });
      mine = null;
    });
  };
</script>

<section class="personal" aria-labelledby="personal-title">
  <h2 id="personal-title">{t('personal_title')}</h2>
  {#if mine === undefined}
    <p>{t('account_loading')}</p>
  {:else if mine}
    <p>{t('personal_ready')}</p>
    <p class="buttons">
      <button type="button" class="button" disabled={busy} onclick={start}>
        {t('personal_start')}
      </button>
      <button type="button" class="plain" disabled={busy} onclick={remove}>
        {t('personal_delete')}
      </button>
    </p>
  {:else}
    <details>
      <summary>{t('personal_offer')}</summary>
      <p class="muted">{t('personal_about')}</p>
      <form onsubmit={create}>
        <label for="me-nickname">{t('personal_nickname')}</label>
        <input id="me-nickname" required minlength="2" maxlength="20" bind:value={nickname} />
        <fieldset>
          <legend>{t('enrol_avatar')}</legend>
          {#each AVATARS as a (a.id)}
            <label class="avatar">
              <input type="radio" name="me-avatar" value={a.id} bind:group={avatar} />
              <span aria-hidden="true">{a.emoji}</span>
              <span class="visually-hidden">{t(`enrol_avatar_${a.id}`)}</span>
            </label>
          {/each}
        </fieldset>
        <label for="me-language">{t('account_class_language')}</label>
        <select id="me-language" bind:value={language}>
          {#each languages as l (l.code)}<option value={l.code}>{l.native}</option>{/each}
        </select>
        <label class="check">
          <input type="checkbox" required bind:checked={adult} />
          {t('personal_adult')}
        </label>
        <label class="check">
          <input type="checkbox" required bind:checked={record} />
          {t('personal_consent')}
        </label>
        <button class="button" type="submit" disabled={busy || !adult || !record}>
          {t('personal_create')}
        </button>
      </form>
      <p class="muted">{t('personal_under_age')}</p>
    </details>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .personal form {
    display: grid;
    gap: var(--space-2);
    max-width: 28rem;
  }
  .personal input:not([type='radio'], [type='checkbox']),
  .personal select {
    font: inherit;
    padding: 0.6rem;
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
  }
  .avatar {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    min-width: 44px;
    font-size: 1.5rem;
  }
  .check {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    min-height: 44px;
  }
  summary {
    min-height: 44px;
    padding-block: 0.6rem;
    cursor: pointer;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
</style>
