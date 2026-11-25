<script lang="ts">
  // A family group (docs/specs/M5-family-and-personal.md, step 2): for homeschooling. A parent
  // starts one, adds new children (the same notice and consents as enrolment) or children they
  // already enrolled elsewhere, at most 8, and can invite a second parent or guardian by a
  // one-time link they confirm. Children sign in on the family phone with the group's code, or
  // the parent taps "Learn as" in Your children. No verification, links, cards or check marks:
  // the database enforces all of it (migration 0024).
  import { onMount } from 'svelte';
  import type { AccountClient } from '../account/client';
  import { spacedCode, whatsappShare } from '../account/classes';
  import { AVATARS, childProblems, NOTICE_VERSION } from '../account/enrol';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
    languages: { code: string; native: string }[];
  }
  let { client, labels, languages }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';

  let classId = $state<string | null | undefined>(undefined);
  let code = $state('');
  let members = $state<{ id: string; nickname: string; avatar: string }[]>([]);
  let mine = $state<{ id: string; nickname: string }[]>([]);
  let waiting = $state<{ id: string; display_name: string; accepted_at: string }[]>([]);
  let link = $state('');
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  let nickname = $state('');
  let grade = $state(4);
  let avatar = $state('robot');
  let language = $state(languages[0]?.code ?? 'en');
  let guardian = $state(false);
  let record = $state(false);

  const outside = $derived(mine.filter((c) => !members.some((m) => m.id === c.id)));

  async function load() {
    classId = (await client.rpc<string | null>('my_family_class')) ?? null;
    mine = await client.select<{ id: string; nickname: string }>('learners', 'id,nickname');
    if (!classId) return;
    const [cls] = await client.select<{ class_code: string }>(
      'classes',
      'class_code',
      `id=eq.${classId}`
    );
    code = cls?.class_code ?? '';
    const rows = await client.select<{
      learner_id: string;
      learners: { nickname: string; avatar: string } | null;
    }>('class_learners', 'learner_id,learners(nickname,avatar)', `class_id=eq.${classId}`);
    members = rows.map((r) => ({
      id: r.learner_id,
      nickname: r.learners?.nickname ?? '',
      avatar: r.learners?.avatar ?? 'robot'
    }));
    waiting = (await client.rpc<typeof waiting | null>('family_invitations_waiting')) ?? [];
  }

  onMount(() => {
    load().catch(() => {
      error = t('account_error');
    });
  });

  async function run(work: () => Promise<void>) {
    busy = true;
    message = '';
    error = '';
    try {
      await work();
      await load();
    } catch (err) {
      error = err instanceof Error && err.message ? err.message : t('account_error');
    } finally {
      busy = false;
    }
  }

  const start = () =>
    run(async () => {
      await client.rpc('create_family_group', { p_language: language });
      message = t('family_started');
    });

  const addNew = (e: SubmitEvent) => {
    e.preventDefault();
    const problems = childProblems({ nickname, grade });
    if (problems.length) {
      error = problems.map(t).join(' ');
      return;
    }
    return run(async () => {
      await client.rpc('enrol_into_family', {
        p_nickname: nickname.trim(),
        p_grade: grade,
        p_avatar: avatar,
        p_language: language,
        p_notice: NOTICE_VERSION
      });
      nickname = '';
      guardian = false;
      record = false;
      message = t('family_child_added');
    });
  };

  const addExisting = (id: string) =>
    run(async () => {
      await client.rpc('add_to_family', { p_learner: id, p_notice: NOTICE_VERSION });
      message = t('family_child_added');
    });

  const invite = () =>
    run(async () => {
      const token = await client.rpc<string>('create_guardian_invitation');
      link = `${location.origin}/account/#guardian=${token}`;
    });

  const confirmGuardian = (id: string) =>
    run(async () => {
      await client.rpc('confirm_guardian', { p_invitation: id });
      message = t('family_guardian_confirmed');
    });
</script>

<section class="family" aria-labelledby="family-title">
  <h2 id="family-title">{t('family_title')}</h2>
  {#if classId === undefined}
    <p>{t('account_loading')}</p>
  {:else if classId === null}
    <p>{t('family_intro')}</p>
    <button type="button" class="button" disabled={busy} onclick={start}>
      {t('family_start')}
    </button>
  {:else}
    <p>
      {t('family_code')} <strong class="code">{spacedCode(code)}</strong>
    </p>
    <p class="muted">{t('family_how')}</p>

    {#if members.length > 0}
      <ul class="members">
        {#each members as m (m.id)}
          <li><span aria-hidden="true">{emoji(m.avatar)}</span> {m.nickname}</li>
        {/each}
      </ul>
    {/if}

    {#if outside.length > 0}
      <h3>{t('family_add_existing')}</h3>
      <ul class="members">
        {#each outside as c (c.id)}
          <li>
            {c.nickname}
            <button type="button" class="plain" disabled={busy} onclick={() => addExisting(c.id)}>
              {t('family_add')}
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if members.length < 8}
      <details>
        <summary>{t('family_add_new')}</summary>
        <form onsubmit={addNew}>
          <p class="muted">{t('enrol_notice_kept')} {t('enrol_notice_not_kept')}</p>
          <label for="fam-nickname">{t('enrol_nickname')}</label>
          <input id="fam-nickname" required minlength="2" maxlength="20" bind:value={nickname} />
          <p class="muted">{t('enrol_nickname_hint')}</p>
          <label for="fam-grade">{t('enrol_grade')}</label>
          <select id="fam-grade" bind:value={grade}>
            {#each Array.from({ length: 12 }, (_, i) => i + 1) as g (g)}<option value={g}>
                {g}
              </option>{/each}
          </select>
          <fieldset>
            <legend>{t('enrol_avatar')}</legend>
            {#each AVATARS as a (a.id)}
              <label class="avatar">
                <input type="radio" name="fam-avatar" value={a.id} bind:group={avatar} />
                <span aria-hidden="true">{a.emoji}</span>
                <span class="visually-hidden">{t(`enrol_avatar_${a.id}`)}</span>
              </label>
            {/each}
          </fieldset>
          <label for="fam-language">{t('account_class_language')}</label>
          <select id="fam-language" bind:value={language}>
            {#each languages as l (l.code)}<option value={l.code}>{l.native}</option>{/each}
          </select>
          <label class="check">
            <input type="checkbox" required bind:checked={guardian} />
            {t('enrol_consent_guardian')}
          </label>
          <label class="check">
            <input type="checkbox" required bind:checked={record} />
            {t('enrol_consent_record')}
          </label>
          <button class="button" type="submit" disabled={busy || !guardian || !record}>
            {t('family_add_child')}
          </button>
        </form>
      </details>
    {:else}
      <p class="muted">{t('family_full')}</p>
    {/if}

    <h3>{t('family_second_title')}</h3>
    <p class="muted">{t('family_second_about')}</p>
    {#if link}
      <p class="link">{link}</p>
      <p class="buttons">
        <a
          class="plain"
          href={whatsappShare(`${t('family_second_share')} ${link}`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('account_class_whatsapp')}
        </a>
      </p>
    {:else}
      <button type="button" class="plain" disabled={busy} onclick={invite}>
        {t('family_second_make')}
      </button>
    {/if}
    {#each waiting as w (w.id)}
      <p>
        {t('family_second_waiting')} <strong>{w.display_name}</strong>
        <button type="button" class="button" disabled={busy} onclick={() => confirmGuardian(w.id)}>
          {t('family_second_confirm')}
        </button>
      </p>
    {/each}
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .family form {
    display: grid;
    gap: var(--space-2);
    max-width: 28rem;
  }
  .family input:not([type='radio'], [type='checkbox']),
  .family select {
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
  .code {
    letter-spacing: 0.1em;
    font-size: 1.2rem;
  }
  .members {
    list-style: none;
    padding: 0;
  }
  .members li {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 44px;
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
  .link {
    overflow-wrap: anywhere;
    font-size: 0.9rem;
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
