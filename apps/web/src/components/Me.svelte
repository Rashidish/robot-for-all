<script lang="ts">
  // The learner's own page (M5 steps 5a and 5b): who is signed in on this phone, recording an
  // answer sheet from its sheet code (answer-sheets Part B), and their records. Recording works
  // offline: records wait in this learner's outbox (ADR-0014) and are sent with their own session
  // when there is a connection. No free text is ever recorded (FR-B4). After 10 idle minutes the
  // phone forgets who is using it.
  import { onMount } from 'svelte';
  import { AVATARS } from '../account/enrol';
  import type { SheetSummary } from '../lessons/answers';
  import { browserOutbox, recordId, type SheetRecord, sendOutbox } from '../learner/outbox';
  import {
    browserStore,
    clearCurrentLearner,
    currentLearner,
    type LearnerSession,
    liveSessions,
    setCurrentLearner
  } from '../learner/sessions';

  interface Props {
    labels: Record<string, string>;
  }
  let { labels }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';
  const store = browserStore();
  const outbox = browserOutbox();
  let me = $state<LearnerSession | null>(null);
  let ready = $state(false);

  // Sheets by code, from /sheets.json (kept offline by the service worker).
  let sheets: Record<string, SheetSummary> = {};
  let code = $state('');
  let sheet = $state<SheetSummary | null>(null);
  let ticks = $state<boolean[]>([]);
  let ican = $state<('yes' | 'no' | '')[]>([]);
  let built = $state(false);
  let team = $state(false);
  let message = $state('');

  interface Row {
    id: string;
    title: string;
    recorded_at: string;
    state: 'waiting' | 'sent' | 'checked';
  }
  let waiting = $state<SheetRecord[]>([]);
  let sent = $state<
    { id: string; sheet_code: string; recorded_at: string; checked_at: string | null }[]
  >([]);
  const titleOf = (c: string) => sheets[c]?.title ?? c;
  const rows = $derived<Row[]>([
    ...waiting.map((r) => ({
      id: r.id,
      title: titleOf(r.sheet_code),
      recorded_at: r.recorded_at,
      state: 'waiting' as const
    })),
    ...sent
      .filter((r) => !waiting.some((w) => w.id === r.id))
      .map((r) => ({
        id: r.id,
        title: titleOf(r.sheet_code),
        recorded_at: r.recorded_at,
        state: r.checked_at ? ('checked' as const) : ('sent' as const)
      }))
  ]);

  const leave = () => {
    clearCurrentLearner(sessionStorage);
    location.href = '/class/';
  };

  // Badges (M5 step 7b): earned automatically from sent sheets; shown with the nickname only.
  let badges = $state<{ badge_id: string; awarded_at: string }[]>([]);
  const badgeName = (id: string) => t(`badge_${id.replace(/-/g, '_')}_name`);

  async function refresh() {
    if (!me) return;
    waiting = await outbox.pending(me.learnerId);
    if (!navigator.onLine) return;
    const r = await sendOutbox(outbox, me.learnerId, me.token, fetch);
    if (r.signedOut) message = t('record_sign_in_again');
    if (r.sent > 0) {
      try {
        const res = await fetch('/cert/badges', {
          method: 'POST',
          headers: { authorization: `Bearer ${me.token}`, 'content-type': 'application/json' },
          body: '{}'
        });
        const { awarded } = res.ok
          ? ((await res.json()) as { awarded: string[] })
          : { awarded: [] };
        if (awarded.length) message = `${t('badge_earned')} ${awarded.map(badgeName).join(', ')}`;
      } catch {
        // The nightly check awards it instead.
      }
    }
    try {
      const res = await fetch(
        '/db/rest/v1/badge_awards?select=badge_id,awarded_at&revoked_at=is.null&order=awarded_at',
        { headers: { authorization: `Bearer ${me.token}`, accept: 'application/json' } }
      );
      if (res.ok) badges = await res.json();
    } catch {
      // Offline: badges show next time.
    }
    waiting = await outbox.pending(me.learnerId);
    try {
      const res = await fetch(
        '/db/rest/v1/sheet_records?select=id,sheet_code,recorded_at,checked_at&order=recorded_at.desc',
        { headers: { authorization: `Bearer ${me.token}`, accept: 'application/json' } }
      );
      if (res.ok) sent = await res.json();
    } catch {
      // Offline: the list shows what is on this phone.
    }
  }

  onMount(() => {
    void (async () => {
      const id = currentLearner(sessionStorage, Date.now());
      me = (await liveSessions(store, Date.now() / 1000)).find((s) => s.learnerId === id) ?? null;
      try {
        const res = await fetch('/sheets.json');
        if (res.ok) sheets = ((await res.json()) as { sheets: typeof sheets }).sheets;
      } catch {
        sheets = {};
      }
      ready = true;
      await refresh();
    })();
    // Any tap or key keeps the phone with this learner; 10 quiet minutes and it forgets.
    const touch = () => me && setCurrentLearner(sessionStorage, me.learnerId, Date.now());
    const check = setInterval(() => {
      if (me && currentLearner(sessionStorage, Date.now()) === null) leave();
    }, 30_000);
    const resend = setInterval(() => void refresh(), 5 * 60_000);
    const online = () => void refresh();
    addEventListener('pointerdown', touch);
    addEventListener('keydown', touch);
    addEventListener('online', online);
    return () => {
      clearInterval(check);
      clearInterval(resend);
      removeEventListener('pointerdown', touch);
      removeEventListener('keydown', touch);
      removeEventListener('online', online);
    };
  });

  const removeMe = async () => {
    if (!me) return;
    if ((await outbox.pending(me.learnerId)).length > 0 && !confirm(t('record_unsent_warning'))) {
      return;
    }
    await store.remove(me.learnerId);
    leave();
  };

  const find = (e: SubmitEvent) => {
    e.preventDefault();
    const found = sheets[code.trim().toLowerCase()];
    message = '';
    if (!found) {
      sheet = null;
      message = t('record_code_unknown');
      return;
    }
    sheet = found;
    ticks = Array.from(
      { length: found.sections.reduce((n, s) => n + 1 + s.steps, 0) },
      () => false
    );
    ican = found.ican.map(() => '');
    built = false;
    team = false;
  };

  // The tick boxes, numbered across the sheet: each section's own box, then its steps.
  const firstBox = (i: number) =>
    (sheet?.sections ?? []).slice(0, i).reduce((n, s) => n + 1 + s.steps, 0);

  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!me || !sheet) return;
    if (ican.some((v) => v === '')) {
      message = t('record_answer_all');
      return;
    }
    const base = {
      learner_id: me.learnerId,
      lesson_id: sheet.lesson,
      sheet_code: code.trim().toLowerCase(),
      steps_done: ticks.filter(Boolean).length,
      i_can: ican.map((v) => v === 'yes'),
      built_working: built,
      team_sheet: team,
      recorded_at: new Date().toISOString()
    };
    await outbox.add({ ...base, id: await recordId(base) });
    sheet = null;
    code = '';
    await refresh();
    message = waiting.length ? t('record_saved_here') : t('record_sent');
  };
</script>

<div class="me" aria-live="polite">
  {#if !ready}
    <p>{t('learner_loading')}</p>
  {:else if !me}
    <p>{t('learner_who_first')}</p>
    <p><a class="button" href="/class/">{t('learner_sign_in')}</a></p>
  {:else}
    <h2><span aria-hidden="true">{emoji(me.avatar)}</span> {t('learner_hello')} {me.nickname}</h2>

    <section aria-labelledby="record-title">
      <h3 id="record-title">{t('record_title')}</h3>
      {#if !sheet}
        <form onsubmit={find}>
          <label for="sheet-code">{t('record_code')}</label>
          <input
            id="sheet-code"
            autocomplete="off"
            spellcheck="false"
            autocapitalize="none"
            required
            bind:value={code}
          />
          <button class="button" type="submit">{t('record_find')}</button>
        </form>
      {:else}
        <form onsubmit={save}>
          <p><strong>{sheet.title}</strong></p>
          <p class="muted">{t('record_tick_what_sheet_shows')}</p>
          {#each sheet.sections as s, i (i)}
            <fieldset>
              <legend>
                <label class="check">
                  <input type="checkbox" bind:checked={ticks[firstBox(i)]} />
                  {s.label}
                </label>
              </legend>
              {#if s.steps > 0}
                <div class="steps">
                  <span>{t('record_steps_done')}</span>
                  {#each Array.from({ length: s.steps }, (_, k) => k) as k (k)}
                    <label class="step">
                      <input type="checkbox" bind:checked={ticks[firstBox(i) + 1 + k]} />
                      {k + 1}
                    </label>
                  {/each}
                </div>
              {/if}
            </fieldset>
          {/each}
          <fieldset>
            <legend>{t('record_ican')}</legend>
            {#each sheet.ican as item, i (i)}
              <div class="ican" role="radiogroup" aria-label={item}>
                <span>{item}</span>
                <label class="check">
                  <input type="radio" name={`ican-${i}`} value="yes" bind:group={ican[i]} />
                  {t('record_yes')}
                </label>
                <label class="check">
                  <input type="radio" name={`ican-${i}`} value="no" bind:group={ican[i]} />
                  {t('record_not_yet')}
                </label>
              </div>
            {/each}
          </fieldset>
          <label class="check">
            <input type="checkbox" bind:checked={built} />
            {t('record_built')}
          </label>
          <label class="check">
            <input type="checkbox" bind:checked={team} />
            {t('record_team')}
          </label>
          <p class="actions">
            <button class="button" type="submit">{t('record_save')}</button>
            <button class="plain" type="button" onclick={() => (sheet = null)}>
              {t('record_cancel')}
            </button>
          </p>
        </form>
      {/if}
    </section>

    {#if badges.length > 0}
      <section aria-labelledby="badges-title">
        <h3 id="badges-title">{t('badge_mine')}</h3>
        <ul class="badges">
          {#each badges as b (b.badge_id)}
            <li>
              <img src={`/badges/${b.badge_id}.svg`} alt="" width="64" height="77" />
              <span>{badgeName(b.badge_id)}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if rows.length > 0}
      <section aria-labelledby="mine-title">
        <h3 id="mine-title">{t('record_mine')}</h3>
        <ul class="records">
          {#each rows as r (r.id)}
            <li>
              <span>{r.title}</span>
              <span class="muted">{new Date(r.recorded_at).toLocaleDateString()}</span>
              <span>
                {r.state === 'waiting'
                  ? t('record_state_waiting')
                  : r.state === 'checked'
                    ? t('record_state_checked')
                    : t('record_state_sent')}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <p class="muted">{t('learner_idle_note')}</p>
    <p class="actions">
      <button type="button" class="button" onclick={leave}>{t('learner_done')}</button>
      <button type="button" class="plain" onclick={removeMe}>{t('learner_remove')}</button>
    </p>
  {/if}
  {#if message}<p class="message" role="status">{message}</p>{/if}
</div>

<style>
  .me h2 span {
    font-size: 2rem;
  }
  .me form {
    display: grid;
    gap: var(--space-2);
    max-width: 30rem;
  }
  .me input:not([type='checkbox'], [type='radio']) {
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
    min-height: 48px;
    cursor: pointer;
  }
  .check {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    min-height: 44px;
  }
  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: center;
  }
  .step {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    min-height: 44px;
    min-width: 44px;
  }
  .ican {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    align-items: center;
    padding-block: 0.25rem;
    border-bottom: 1px solid var(--color-border);
  }
  .ican span {
    flex-basis: 100%;
  }
  .badges {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }
  .badges li {
    display: grid;
    justify-items: center;
    max-width: 6rem;
    text-align: center;
    font-weight: 600;
  }
  .records {
    padding-left: 1.2rem;
  }
  .records li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
  }
</style>
