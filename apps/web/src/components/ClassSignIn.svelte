<script lang="ts">
  // A class's learners and how they sign in (M5 step 5c, ADR-0013), for its teachers and coaches:
  // who has chosen their secret pictures, who is locked after 5 wrong tries, a one-tap PIN reset
  // (the learner chooses new pictures), "sign out everywhere", and QR sign-in cards for events.
  // Card secrets live only in this page until printed; the database keeps their hashes.
  import type { AccountClient } from '../account/client';
  import { AVATARS } from '../account/enrol';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
    classId: string;
    className: string;
  }
  let { client, labels, classId, className }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const emoji = (id: string) => AVATARS.find((a) => a.id === id)?.emoji ?? '🤖';

  interface Status {
    learner_id: string;
    nickname: string;
    avatar: string;
    has_pin: boolean;
    locked: boolean;
  }
  let learners = $state<Status[] | null>(null);
  let cards = $state<{ nickname: string; avatar: string; qr: string }[]>([]);
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  async function load() {
    learners =
      (await client.rpc<Status[] | null>('class_learner_status', { p_class: classId })) ?? [];
  }

  async function run(work: () => Promise<void>) {
    busy = true;
    message = '';
    error = '';
    try {
      await work();
    } catch (err) {
      error = err instanceof Error && err.message ? err.message : t('account_error');
    } finally {
      busy = false;
    }
  }

  const resetPin = (l: Status) =>
    run(async () => {
      await client.rpc('reset_learner_pin', { p_learner: l.learner_id });
      await load();
      message = `${t('signin_reset_done')} ${l.nickname}`;
    });

  const signOutEverywhere = (l: Status) =>
    run(async () => {
      await client.rpc('revoke_learner_sessions', { p_learner: l.learner_id });
      message = `${t('signin_signed_out')} ${l.nickname}`;
    });

  const makeCards = () => {
    if (!confirm(t('signin_cards_confirm'))) return;
    return run(async () => {
      const rows =
        (await client.rpc<{ nickname: string; avatar: string; secret: string }[] | null>(
          'create_sign_in_cards',
          { p_class: classId }
        )) ?? [];
      const { default: qrcode } = await import('qrcode-generator');
      cards = rows.map((r) => {
        const code = qrcode(0, 'M');
        code.addData(`${location.origin}/class/#card=${r.secret}`);
        code.make();
        return { nickname: r.nickname, avatar: r.avatar, qr: code.createDataURL(4, 4) };
      });
      message = t('signin_cards_ready');
    });
  };

  const printCards = () => {
    document.body.classList.add('printing-cards');
    const done = () => {
      document.body.classList.remove('printing-cards');
      removeEventListener('afterprint', done);
    };
    addEventListener('afterprint', done);
    print();
  };

  const withdrawCards = () =>
    run(async () => {
      await client.rpc('revoke_sign_in_cards', { p_class: classId });
      cards = [];
      message = t('signin_cards_withdrawn');
    });
</script>

<details
  class="class-signin"
  ontoggle={(e) => (e.currentTarget as HTMLDetailsElement).open && !learners && run(load)}
>
  <summary>{t('signin_title')}</summary>
  {#if learners === null}
    <p>{t('account_loading')}</p>
  {:else if learners.length === 0}
    <p class="muted">{t('signin_none')}</p>
  {:else}
    <ul class="status">
      {#each learners as l (l.learner_id)}
        <li>
          <span><span aria-hidden="true">{emoji(l.avatar)}</span> {l.nickname}</span>
          <span class="state">
            {l.locked ? t('signin_locked') : l.has_pin ? t('signin_has_pin') : t('signin_no_pin')}
          </span>
          <span class="buttons">
            {#if l.has_pin || l.locked}
              <button type="button" class="plain" disabled={busy} onclick={() => resetPin(l)}>
                {t('signin_reset')}
              </button>
            {/if}
            <button
              type="button"
              class="plain"
              disabled={busy}
              onclick={() => signOutEverywhere(l)}
            >
              {t('signin_sign_out_everywhere')}
            </button>
          </span>
        </li>
      {/each}
    </ul>
    <h4>{t('signin_cards_title')}</h4>
    <p class="muted">{t('signin_cards_about')}</p>
    <p class="buttons">
      <button type="button" class="button" disabled={busy} onclick={makeCards}>
        {t('signin_cards_make')}
      </button>
      <button type="button" class="plain" disabled={busy} onclick={withdrawCards}>
        {t('signin_cards_withdraw')}
      </button>
    </p>
    {#if cards.length > 0}
      <p>
        <button type="button" class="button" onclick={printCards}>{t('signin_cards_print')}</button>
      </p>
      <div class="print-cards" aria-label={`${t('signin_cards_title')}: ${className}`}>
        {#each cards as c, i (i)}
          <div class="card">
            <img src={c.qr} alt={`${t('signin_card_qr')} ${c.nickname}`} width="132" height="132" />
            <p><span aria-hidden="true">{emoji(c.avatar)}</span> <strong>{c.nickname}</strong></p>
            <p class="small">{className}</p>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</details>

<style>
  summary {
    min-height: 44px;
    padding-block: 0.6rem;
    cursor: pointer;
  }
  .status {
    padding-left: 0;
    list-style: none;
  }
  .status li {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.75rem;
    align-items: center;
    padding-block: 0.4rem;
    border-bottom: 1px solid var(--color-border);
  }
  .state {
    color: var(--color-muted);
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .button {
    border: 0;
    font: inherit;
    font-weight: 600;
    min-height: 44px;
    cursor: pointer;
  }
  .print-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-2);
  }
  .card {
    border: 1px dashed var(--color-border);
    padding: var(--space-2);
    text-align: center;
    break-inside: avoid;
  }
  .card img {
    width: 100%;
    max-width: 132px;
    height: auto;
    image-rendering: pixelated;
  }
  .card p {
    margin: 0.25rem 0;
  }
  .small {
    font-size: 0.8rem;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
  /* Printing the cards prints only the cards, six to a row on A4. */
  @media print {
    :global(body.printing-cards *) {
      visibility: hidden;
    }
    :global(body.printing-cards .print-cards),
    :global(body.printing-cards .print-cards *) {
      visibility: visible;
    }
    :global(body.printing-cards .print-cards) {
      position: absolute;
      inset: 0;
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
