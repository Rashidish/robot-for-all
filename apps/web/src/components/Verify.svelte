<script lang="ts">
  // Check a certificate (M5 FR-29): anyone types the code printed on a certificate or badge card,
  // or scans its QR code (/verify/#RFA-XXXX-XX). Shows the badge, the date and the school or club
  // (or "Awarded by Robots For All"), never a name or nickname. Works without signing in.
  import { onMount } from 'svelte';

  interface Props {
    labels: Record<string, string>;
  }
  let { labels }: Props = $props();
  const t = (key: string) => labels[key] ?? key;
  const badgeName = (id: string) => t(`badge_${id.replace(/-/g, '_')}_name`);
  const CODE = /^RFA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/;

  let code = $state('');
  let busy = $state(false);
  let result = $state<
    | { kind: 'found'; badge: string; date: string; label: string; valid: boolean }
    | { kind: 'unknown' }
    | { kind: 'error' }
    | null
  >(null);

  const tidy = (s: string) => {
    const raw = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const body = raw.startsWith('RFA') ? raw.slice(3) : raw;
    return body.length === 6 ? `RFA-${body.slice(0, 4)}-${body.slice(4)}` : s.trim().toUpperCase();
  };

  async function check() {
    const c = tidy(code);
    code = c;
    if (!CODE.test(c)) {
      result = { kind: 'unknown' };
      return;
    }
    busy = true;
    try {
      const res = await fetch('/db/rest/v1/rpc/verify_certificate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ p_code: c })
      });
      if (!res.ok) throw new Error('verify');
      const rows = (await res.json()) as {
        badge_id: string;
        issued_on: string;
        issued_by_label: string;
        valid: boolean;
      }[];
      const r = rows[0];
      result = r
        ? {
            kind: 'found',
            badge: r.badge_id,
            date: r.issued_on,
            label: r.issued_by_label,
            valid: r.valid
          }
        : { kind: 'unknown' };
    } catch {
      result = { kind: 'error' };
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    const fromLink = decodeURIComponent(location.hash.slice(1));
    if (fromLink) {
      code = fromLink;
      void check();
    }
  });
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    void check();
  }}
>
  <label for="code">{t('verify_code')}</label>
  <input
    id="code"
    autocomplete="off"
    spellcheck="false"
    autocapitalize="characters"
    required
    bind:value={code}
  />
  <button class="button" type="submit" disabled={busy}>{t('verify_check')}</button>
</form>

<div aria-live="polite">
  {#if result?.kind === 'found'}
    <section class="result" class:revoked={!result.valid}>
      <img src={`/badges/${result.badge}.svg`} alt="" width="80" height="96" />
      <div>
        <p class="state">{result.valid ? t('verify_valid') : t('verify_revoked')}</p>
        <p><strong>{badgeName(result.badge)}</strong></p>
        <p>{t('verify_date')} {new Date(result.date).toLocaleDateString()}</p>
        <p>
          {result.label === 'Robots For All'
            ? t('verify_awarded_by_rfa')
            : `${t('verify_school')} ${result.label}`}
        </p>
        <p class="muted">{t('verify_no_names')}</p>
      </div>
    </section>
  {:else if result?.kind === 'unknown'}
    <p role="alert">{t('verify_unknown')}</p>
  {:else if result?.kind === 'error'}
    <p role="alert">{t('verify_error')}</p>
  {/if}
</div>

<style>
  form {
    display: grid;
    gap: var(--space-2);
    max-width: 20rem;
  }
  input {
    font: inherit;
    font-size: 1.25rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.6rem;
    min-height: 48px;
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
  .result {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
    margin-block: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border-left: 4px solid var(--color-accent);
  }
  .result p {
    margin: 0.25rem 0;
  }
  .state {
    font-weight: 700;
  }
  .revoked img {
    opacity: 0.4;
  }
</style>
