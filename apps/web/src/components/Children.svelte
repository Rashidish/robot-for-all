<script lang="ts">
  // Your children (M5 step 4c, spec FR-9, FR-10): a parent sees each child they enrolled, the
  // classes the child is in, takes the child out of a class (withdraws that class's consent),
  // saves a copy of everything kept, or deletes the child's profile and records for good.
  // Shown only to adults who have children; the database checks every action.
  import { onMount } from 'svelte';
  import type { AccountClient } from '../account/client';
  import {
    type Child,
    type ChildClass,
    type Consent,
    type LearnerRow,
    portfolio,
    portfolioFileName,
    withClasses
  } from '../account/children';
  import { AccountError } from '../account/client';
  import { saveFile } from '../account/download';
  import { learnAs } from '../learner/learn-as';
  import { AVATARS, NOTICE_VERSION } from '../account/enrol';
  import { lessonTitle, type ProgressRecord, progressGrid } from '../account/progress';
  import type { SheetSummary } from '../lessons/answers';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
    /** The AI helper is on: show control (e), "Let my child ask the AI helper" (M6 FR-6). */
    helper?: boolean;
  }
  let { client, labels, helper = false }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';

  let children = $state<Child[]>([]);
  let classes = $state<ChildClass[]>([]);
  let confirming = $state<string | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  const view = $derived(withClasses(children, classes));
  // Each child's progress (FR-16): their lessons, what is "Not yet", what a teacher checked.
  let progress = $state<Record<string, ProgressRecord[]>>({});
  let sheets = $state<Record<string, SheetSummary>>({});
  let childBadges = $state<Record<string, { id: string; badge_id: string }[]>>({});
  const downloadCertificate = (award: string, kind: 'certificate' | 'card') =>
    run(async () => {
      const pdf = await client.certPdf('certificate', { award, kind });
      saveFile(pdf, kind === 'card' ? 'badge-card.pdf' : 'certificate.pdf');
      message = t('children_cert_saved');
    });
  const badgeName = (id: string) => t(`badge_${id.replace(/-/g, '_')}_name`);
  async function loadProgress(child: Child) {
    if (progress[child.id]) return;
    if (Object.keys(sheets).length === 0) {
      try {
        const res = await fetch('/sheets.json');
        if (res.ok) sheets = ((await res.json()) as { sheets: typeof sheets }).sheets;
      } catch {
        sheets = {};
      }
    }
    childBadges[child.id] = await client.select<{ id: string; badge_id: string }>(
      'badge_awards',
      'id,badge_id',
      `learner_id=eq.${child.id}&revoked_at=is.null`
    );
    progress[child.id] = await client.select<ProgressRecord>(
      'sheet_records',
      'id,learner_id,lesson_id,sheet_code,steps_done,i_can,built_working,team_sheet,recorded_at,checked_at,revoked_at',
      `learner_id=eq.${child.id}`
    );
  }
  const cellsFor = (child: Child) =>
    [...(progressGrid(progress[child.id] ?? [], sheets).get(child.id) ?? new Map()).entries()].sort(
      ([a], [b]) => a.localeCompare(b)
    );
  // The certificate name (FR-20 to FR-22): typed here, sent only to the certificate service,
  // never read back. We only learn whether one is stored.
  let hasName = $state<Record<string, boolean>>({});
  let nameDraft = $state<Record<string, string>>({});
  let nameConsent = $state<Record<string, boolean>>({});
  // Consent control (e), the AI helper (M6 FR-6): off by default; on only with this notice.
  const HELPER_NOTICE = '1.1';
  let helperOn = $state<Record<string, boolean>>({});
  let helperConsent = $state<Record<string, boolean>>({});

  async function load() {
    const [kids, rows] = await Promise.all([
      client.select<Child>('learners', 'id,nickname,grade,avatar,language,created_at'),
      client.rpc<ChildClass[] | null>('my_children_classes')
    ]);
    const self = await client.rpc<string | null>('my_personal_learner').catch(() => null);
    children = (kids ?? []).filter((k) => k.id !== self);
    classes = rows ?? [];
    const flags = await Promise.all(
      children.map((c) => client.rpc<boolean | null>('has_certificate_name', { p_learner: c.id }))
    );
    hasName = Object.fromEntries(children.map((c, i) => [c.id, flags[i] === true]));
    if (helper) {
      const rows =
        (await client
          .rpc<{ learner_id: string; helper_on: boolean }[] | null>('my_children_helper')
          .catch(() => null)) ?? [];
      helperOn = Object.fromEntries(rows.map((r) => [r.learner_id, r.helper_on]));
    }
  }

  const setHelper = (child: Child, on: boolean) =>
    run(async () => {
      await client.rpc('set_helper_consent', {
        p_learner: child.id,
        p_on: on,
        p_notice: on ? HELPER_NOTICE : null
      });
      helperOn[child.id] = on;
      helperConsent[child.id] = false;
      message = on ? t('children_helper_turned_on') : t('children_helper_turned_off');
    });

  const saveName = (e: SubmitEvent, child: Child) => {
    e.preventDefault();
    return run(async () => {
      try {
        await client.cert('name', {
          learner: child.id,
          name: nameDraft[child.id] ?? '',
          notice: NOTICE_VERSION
        });
      } catch (err) {
        if (err instanceof AccountError && err.status === 422) {
          throw new Error(t('children_name_invalid'), { cause: err });
        }
        throw err;
      }
      nameDraft[child.id] = '';
      nameConsent[child.id] = false;
      hasName[child.id] = true;
      message = t('children_name_saved');
    });
  };

  const removeName = (child: Child) =>
    run(async () => {
      await client.rpc('withdraw_consent', { p_learner: child.id, p_control: 'name' });
      hasName[child.id] = false;
      message = t('children_name_removed');
    });

  onMount(() => {
    load().catch(() => {
      error = t('account_error');
    });
  });

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

  const leaveClass = (child: Child, c: ChildClass) =>
    run(async () => {
      await client.rpc('withdraw_consent', {
        p_learner: child.id,
        p_control: 'class',
        p_class: c.class_id
      });
      await load();
      message = t('children_left_class');
    });

  const remove = (child: Child) =>
    run(async () => {
      await client.rpc('delete_learner', { p_learner: child.id });
      confirming = null;
      await load();
      message = t('children_deleted');
    });

  const download = (child: Child) =>
    run(async () => {
      const filter = `learner_id=eq.${child.id}`;
      const [consents, records, badges] = await Promise.all([
        client.select<Consent>(
          'consents',
          'learner_id,control,class_id,notice_version,given_at,withdrawn_at',
          filter
        ),
        client.select<LearnerRow>(
          'sheet_records',
          'learner_id,lesson_id,steps_done,i_can,built_working,team_sheet,recorded_at,checked_at',
          filter
        ),
        client.select<LearnerRow>(
          'badge_awards',
          'learner_id,badge_id,awarded_at,revoked_at',
          filter
        )
      ]);
      const file = portfolio(child, { classes, consents, records, badges });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = portfolioFileName(child.nickname);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
</script>

{#if view.length > 0}
  <section class="children" aria-labelledby="children-title">
    <h2 id="children-title">{t('children_title')}</h2>
    {#each view as child (child.id)}
      <article aria-labelledby={`child-${child.id}`}>
        <h3 id={`child-${child.id}`}>
          <span aria-hidden="true">{emoji(child.avatar)}</span>
          {child.nickname}
          <small>· {t('enrol_grade')} {child.grade}</small>
        </h3>
        {#if child.classes.length === 0}
          <p class="muted">{t('children_no_class')}</p>
        {:else}
          <ul>
            {#each child.classes as c (c.class_id)}
              <li>
                {c.class_name} · {c.organisation_name}
                <button
                  class="button secondary"
                  type="button"
                  disabled={busy}
                  onclick={() => leaveClass(child, c)}
                >
                  {t('children_leave_class')}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <details
          class="name"
          ontoggle={(e) =>
            (e.currentTarget as HTMLDetailsElement).open && run(() => loadProgress(child))}
        >
          <summary>{t('progress_child_title')}</summary>
          {#if (childBadges[child.id] ?? []).length > 0}
            <ul class="child-badges" aria-label={t('badge_mine')}>
              {#each childBadges[child.id] ?? [] as b (b.id)}
                <li>
                  <img src={`/badges/${b.badge_id}.svg`} alt="" width="48" height="58" />
                  {badgeName(b.badge_id)}
                  <button
                    type="button"
                    class="plain"
                    disabled={busy}
                    onclick={() => downloadCertificate(b.id, 'certificate')}
                  >
                    {t('children_certificate')}
                  </button>
                  <button
                    type="button"
                    class="plain"
                    disabled={busy}
                    onclick={() => downloadCertificate(b.id, 'card')}
                  >
                    {t('children_badge_card')}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
          {#if progress[child.id] && cellsFor(child).length === 0}
            <p class="muted">{t('progress_child_none')}</p>
          {:else if progress[child.id]}
            <ul class="lessons">
              {#each cellsFor(child) as [lesson, c] (lesson)}
                <li>
                  <strong>{lessonTitle(lesson, sheets, child.language)}</strong>:
                  {c.done ? t('progress_done') : c.notYet.length ? '' : t('progress_started')}
                  {#if c.notYet.length}{t('progress_not_yet_items')} {c.notYet.join('; ')}{/if}
                  {#if c.checked}· {t('progress_checked')}{/if}
                </li>
              {/each}
            </ul>
          {:else}
            <p>{t('account_loading')}</p>
          {/if}
        </details>
        <details class="name">
          <summary>
            {t('children_name_title')}:
            <strong>
              {hasName[child.id] ? t('children_name_added') : t('children_name_none')}
            </strong>
          </summary>
          <p class="muted">{t('children_name_about')}</p>
          <form onsubmit={(e) => saveName(e, child)}>
            <label for={`name-${child.id}`}>
              {hasName[child.id] ? t('children_name_replace') : t('children_name_label')}
            </label>
            <input
              id={`name-${child.id}`}
              autocomplete="off"
              spellcheck="false"
              required
              minlength="2"
              maxlength="80"
              bind:value={nameDraft[child.id]}
            />
            <label class="check">
              <input type="checkbox" required bind:checked={nameConsent[child.id]} />
              {t('children_name_consent')}
            </label>
            <button class="button" type="submit" disabled={busy || !nameConsent[child.id]}>
              {t('children_name_save')}
            </button>
          </form>
          {#if hasName[child.id]}
            <button
              class="button secondary"
              type="button"
              disabled={busy}
              onclick={() => removeName(child)}
            >
              {t('children_name_remove')}
            </button>
          {/if}
        </details>
        {#if helper}
          <details class="helper-control">
            <summary>
              {t('children_helper_title')}:
              <strong>
                {helperOn[child.id] ? t('children_helper_on') : t('children_helper_off')}
              </strong>
            </summary>
            <p class="muted">{t('children_helper_about')}</p>
            <p class="muted">{t('children_helper_sent')}</p>
            <p class="muted">{t('children_helper_kept')}</p>
            {#if helperOn[child.id]}
              <button
                class="button secondary"
                type="button"
                disabled={busy}
                onclick={() => setHelper(child, false)}
              >
                {t('children_helper_turn_off')}
              </button>
            {:else}
              <label class="check">
                <input type="checkbox" bind:checked={helperConsent[child.id]} />
                {t('children_helper_consent')}
              </label>
              <button
                class="button"
                type="button"
                disabled={busy || !helperConsent[child.id]}
                onclick={() => setHelper(child, true)}
              >
                {t('children_helper_turn_on')}
              </button>
            {/if}
          </details>
        {/if}
        <p>
          <button
            type="button"
            class="button"
            disabled={busy}
            onclick={() =>
              run(async () => {
                if (!(await learnAs(client, child.id))) error = t('account_error');
              })}
          >
            {t('family_learn_as')}
            {child.nickname}
          </button>
        </p>
        <div class="actions">
          <button
            class="button secondary"
            type="button"
            disabled={busy}
            onclick={() => download(child)}
          >
            {t('children_download')}
          </button>
          {#if confirming === child.id}
            <p role="alert">{t('children_delete_warning')}</p>
            <button
              class="button danger"
              type="button"
              disabled={busy}
              onclick={() => remove(child)}
            >
              {t('children_delete_confirm')}
            </button>
            <button class="button secondary" type="button" onclick={() => (confirming = null)}>
              {t('children_cancel')}
            </button>
          {:else}
            <button class="button secondary" type="button" onclick={() => (confirming = child.id)}>
              {t('children_delete')}
            </button>
          {/if}
        </div>
      </article>
    {/each}
    <p class="muted">{t('children_more')}</p>
  </section>
{/if}
{#if message}<p role="status">{message}</p>{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
  .children article {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: var(--space-2) var(--space-4);
    margin-block: var(--space-4);
  }
  .children ul {
    padding-left: 1.2rem;
  }
  .children li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    margin-block: var(--space-2);
  }
  .child-badges {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
  }
  .child-badges li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
  }
  .name form {
    display: grid;
    gap: var(--space-2);
    margin-block: var(--space-2);
  }
  .name input:not([type='checkbox']) {
    font: inherit;
    padding: 0.6rem;
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .name summary {
    min-height: 44px;
    padding-block: 0.6rem;
    cursor: pointer;
  }
  .check {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .actions p {
    flex-basis: 100%;
    margin: 0;
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .button.secondary {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }
  .button.danger {
    background: var(--color-error, #b3261e);
    color: #fff;
  }
  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
</style>
