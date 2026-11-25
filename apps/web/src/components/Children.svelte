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
  import { AVATARS } from '../account/enrol';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
  }
  let { client, labels }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';

  let children = $state<Child[]>([]);
  let classes = $state<ChildClass[]>([]);
  let confirming = $state<string | null>(null);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  const view = $derived(withClasses(children, classes));

  async function load() {
    const [kids, rows] = await Promise.all([
      client.select<Child>('learners', 'id,nickname,grade,avatar,language,created_at'),
      client.rpc<ChildClass[] | null>('my_children_classes')
    ]);
    children = kids ?? [];
    classes = rows ?? [];
  }

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
