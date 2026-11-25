<script lang="ts">
  // A class's progress grid (M5 step 6, FR-14, FR-15): learners by nickname × lessons, from the
  // answer sheets they recorded. Done, "Not yet", built and working, checked. Tap a cell to see
  // the record and spot-check it (mark it checked against the signed paper sheet) or revoke it if
  // it is wrong. Checking is optional, never a gate. The database allows this only for the
  // learner's own teachers and coaches (check_record).
  import type { AccountClient } from '../account/client';
  import { saveFile } from '../account/download';
  import {
    type Cell,
    gridLessons,
    lessonTitle,
    type ProgressRecord,
    progressGrid
  } from '../account/progress';
  import type { SheetSummary } from '../lessons/answers';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
    classId: string;
    language: string;
  }
  let { client, labels, classId, language }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  let roster = $state<{ id: string; nickname: string }[] | null>(null);
  let records = $state<ProgressRecord[]>([]);
  let sheets = $state<Record<string, SheetSummary>>({});
  let phase = $state<number | null>(null);
  let open = $state<{ learner: string; lesson: string } | null>(null);
  // Badges (M5 step 7d, FR-15): "badges need a check" for this class, and each learner's badges
  // with a way to revoke one awarded by mistake.
  let needCheck = $state(false);
  let awards = $state<{ id: string; learner_id: string; badge_id: string }[]>([]);
  const badgeName = (id: string) => t(`badge_${id.replace(/-/g, '_')}_name`);
  let busy = $state(false);
  let error = $state('');

  const grid = $derived(progressGrid(records, sheets));
  const lessons = $derived(gridLessons(grid, phase));
  const chosen = $derived<Cell | undefined>(
    open ? grid.get(open.learner)?.get(open.lesson) : undefined
  );
  const nicknameOf = (id: string) => roster?.find((r) => r.id === id)?.nickname ?? '';

  async function load() {
    const rows = await client.select<{ learner_id: string; learners: { nickname: string } | null }>(
      'class_learners',
      'learner_id,learners(nickname)',
      `class_id=eq.${classId}`
    );
    roster = rows
      .map((r) => ({ id: r.learner_id, nickname: r.learners?.nickname ?? '' }))
      .sort((a, b) => a.nickname.localeCompare(b.nickname));
    const [cls] = await client.select<{ badges_need_check: boolean }>(
      'classes',
      'badges_need_check',
      `id=eq.${classId}`
    );
    needCheck = cls?.badges_need_check ?? false;
    if (roster.length > 0) {
      awards = await client.select<{ id: string; learner_id: string; badge_id: string }>(
        'badge_awards',
        'id,learner_id,badge_id',
        `learner_id=in.(${roster.map((r) => r.id).join(',')})&revoked_at=is.null`
      );
      records = await client.select<ProgressRecord>(
        'sheet_records',
        'id,learner_id,lesson_id,sheet_code,steps_done,i_can,built_working,team_sheet,recorded_at,checked_at,revoked_at',
        `learner_id=in.(${roster.map((r) => r.id).join(',')})`
      );
    }
    try {
      const res = await fetch('/sheets.json');
      if (res.ok) sheets = ((await res.json()) as { sheets: typeof sheets }).sheets;
    } catch {
      sheets = {};
    }
  }

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

  const mark = (c: Cell, revoke: boolean) => {
    if (revoke && !confirm(t('progress_revoke_confirm'))) return;
    return run(async () => {
      await client.rpc('check_record', { p_record: c.record.id, p_revoke: revoke });
      await load();
    });
  };

  const setNeedCheck = (on: boolean) =>
    run(async () => {
      await client.rpc('set_badges_need_check', { p_class: classId, p_on: on });
      needCheck = on;
    });

  const revokeBadge = (a: { id: string; badge_id: string }, nickname: string) => {
    if (!confirm(`${t('progress_revoke_badge_confirm')} ${badgeName(a.badge_id)} (${nickname})`))
      return;
    return run(async () => {
      await client.rpc('revoke_badge', { p_award: a.id });
      await load();
    });
  };

  let printBadge = $state('');
  let printKind = $state<'certificate' | 'card'>('certificate');
  const printClass = () =>
    run(async () => {
      const pdf = await client.certPdf('certificates', {
        class: classId,
        kind: printKind,
        language,
        ...(printBadge ? { badge: printBadge } : {})
      });
      saveFile(pdf, printKind === 'card' ? 'badge-cards.pdf' : 'certificates.pdf');
    });

  const symbol = (c: Cell | undefined) =>
    !c ? '·' : c.done ? (c.checked ? '✔' : '✓') : c.notYet.length ? `◐${c.notYet.length}` : '…';
  const describe = (nickname: string, lesson: string, c: Cell | undefined) =>
    `${nickname}, ${lessonTitle(lesson, sheets, language)}: ${
      !c
        ? t('progress_none')
        : c.done
          ? t('progress_done')
          : c.notYet.length
            ? `${t('progress_not_yet')} ${c.notYet.length}`
            : t('progress_started')
    }${c?.checked ? `, ${t('progress_checked')}` : ''}`;
</script>

<details
  class="progress"
  ontoggle={(e) => (e.currentTarget as HTMLDetailsElement).open && roster === null && run(load)}
>
  <summary>{t('progress_title')}</summary>
  {#if roster === null}
    <p>{t('account_loading')}</p>
  {:else if roster.length === 0}
    <p class="muted">{t('signin_none')}</p>
  {:else}
    <label for={`phase-${classId}`}>{t('progress_phase')}</label>
    <select
      id={`phase-${classId}`}
      onchange={(e) => {
        const v = (e.currentTarget as HTMLSelectElement).value;
        phase = v ? Number(v) : null;
      }}
    >
      <option value="">{t('progress_all_phases')}</option>
      <option value="1">1</option>
      <option value="2">2</option>
      <option value="3">3</option>
    </select>
    <label class="check">
      <input
        type="checkbox"
        checked={needCheck}
        disabled={busy}
        onchange={(e) => setNeedCheck((e.currentTarget as HTMLInputElement).checked)}
      />
      {t('progress_need_check')}
    </label>
    <p class="muted legend">{t('progress_legend')}</p>
    {#if lessons.length === 0}
      <p class="muted">{t('progress_no_records')}</p>
    {:else}
      <div class="scroll" role="region" aria-label={t('progress_title')} tabindex="-1">
        <table>
          <thead>
            <tr>
              <th scope="col">{t('progress_learner')}</th>
              {#each lessons as lesson (lesson)}
                <th scope="col" title={lessonTitle(lesson, sheets, language)}>
                  {lessonTitle(lesson, sheets, language)}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each roster as l (l.id)}
              <tr>
                <th scope="row">{l.nickname}</th>
                {#each lessons as lesson (lesson)}
                  {@const c = grid.get(l.id)?.get(lesson)}
                  <td>
                    {#if c}
                      <button
                        type="button"
                        class="cell"
                        aria-label={describe(l.nickname, lesson, c)}
                        onclick={() => (open = { learner: l.id, lesson })}
                      >
                        {symbol(c)}
                      </button>
                    {:else}
                      <span aria-label={describe(l.nickname, lesson, c)}>·</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
    {#if open && chosen}
      <section class="record" aria-labelledby={`rec-${classId}`}>
        <h4 id={`rec-${classId}`}>
          {nicknameOf(open.learner)}: {lessonTitle(open.lesson, sheets, language)}
        </h4>
        <ul>
          <li>
            {t('progress_recorded')}
            {new Date(chosen.record.recorded_at).toLocaleDateString()}
          </li>
          <li>
            {t('progress_steps')}
            {chosen.steps}{chosen.boxes === null ? '' : ` / ${chosen.boxes}`}
          </li>
          <li>
            {chosen.notYet.length === 0
              ? t('progress_all_yes')
              : `${t('progress_not_yet_items')} ${chosen.notYet.join('; ')}`}
          </li>
          <li>{chosen.record.built_working ? t('progress_built') : t('progress_not_built')}</li>
          {#if chosen.record.team_sheet}<li>{t('progress_team')}</li>{/if}
          {#if chosen.checked}<li>{t('progress_checked')}</li>{/if}
        </ul>
        <p class="buttons">
          {#if !chosen.checked}
            <button
              type="button"
              class="button"
              disabled={busy}
              onclick={() => mark(chosen, false)}
            >
              {t('progress_mark_checked')}
            </button>
          {/if}
          <button type="button" class="plain" disabled={busy} onclick={() => mark(chosen, true)}>
            {t('progress_revoke')}
          </button>
          <button type="button" class="plain" onclick={() => (open = null)}>
            {t('progress_close')}
          </button>
        </p>
      </section>
    {/if}
  {/if}
  {#if roster && awards.length > 0}
    <h4>{t('badge_mine')}</h4>
    <div class="print">
      <label for={`pb-${classId}`}>{t('progress_print_badge')}</label>
      <select id={`pb-${classId}`} bind:value={printBadge}>
        <option value="">{t('progress_print_all')}</option>
        {#each [...new Set(awards.map((a) => a.badge_id))] as id (id)}
          <option value={id}>{badgeName(id)}</option>
        {/each}
      </select>
      <label for={`pk-${classId}`}>{t('progress_print_kind')}</label>
      <select id={`pk-${classId}`} bind:value={printKind}>
        <option value="certificate">{t('progress_print_certificates')}</option>
        <option value="card">{t('progress_print_cards')}</option>
      </select>
      <button type="button" class="button" disabled={busy} onclick={printClass}>
        {t('progress_print_download')}
      </button>
      <p class="muted">{t('progress_print_note')}</p>
    </div>
    <ul class="awards">
      {#each roster.filter((l) => awards.some((a) => a.learner_id === l.id)) as l (l.id)}
        <li>
          <strong>{l.nickname}:</strong>
          {#each awards.filter((a) => a.learner_id === l.id) as a (a.id)}
            <span class="award">
              {badgeName(a.badge_id)}
              <button
                type="button"
                class="plain"
                disabled={busy}
                onclick={() => revokeBadge(a, l.nickname)}
              >
                {t('progress_revoke_badge')}
              </button>
            </span>
          {/each}
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</details>

<style>
  summary {
    min-height: 44px;
    padding-block: 0.6rem;
    cursor: pointer;
  }
  select {
    font: inherit;
    min-height: 44px;
    margin-inline-start: var(--space-2);
  }
  .scroll {
    overflow-x: auto;
    max-width: 100%;
  }
  table {
    border-collapse: collapse;
  }
  th,
  td {
    border: 1px solid var(--color-border);
    padding: 0.25rem;
    text-align: center;
  }
  thead th {
    font-size: 0.75rem;
    font-weight: 600;
    max-width: 6rem;
    overflow-wrap: anywhere;
  }
  tbody th {
    text-align: left;
    white-space: nowrap;
  }
  .cell {
    min-width: 44px;
    min-height: 44px;
    font: inherit;
    border: 0;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }
  .record {
    margin-block: var(--space-2);
    padding: var(--space-2);
    border-left: 4px solid var(--color-accent);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .check {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 44px;
  }
  .print {
    display: grid;
    gap: var(--space-2);
    max-width: 24rem;
    margin-block: var(--space-2);
  }
  .awards li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: center;
    padding-block: 0.25rem;
  }
  .award {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
</style>
