<script lang="ts">
  // Schools, clubs and classes (M5 step 3c): register a school or club (verified once by the
  // back office), make classes, and share each class's enrolment link and QR code with parents.
  // Every rule (staff only, one trial class, 40 learners) is checked by the database.
  import { onMount } from 'svelte';
  import type { AccountClient } from '../account/client';
  import {
    enrolLink,
    GRADE_BANDS,
    type OrganisationForm,
    organisationProblems,
    PROVINCES,
    registerArgs,
    spacedCode,
    whatsappShare
  } from '../account/classes';

  interface Props {
    client: AccountClient;
    labels: Record<string, string>;
    languages: { code: string; native: string }[];
  }
  let { client, labels, languages }: Props = $props();
  const t = (key: string) => labels[key] ?? key;

  interface Org {
    role: 'admin' | 'teacher' | 'coach';
    organisations: {
      id: string;
      name: string;
      kind: 'school' | 'club';
      verified_at: string | null;
    } | null;
  }
  interface ClassRow {
    id: string;
    organisation_id: string;
    name: string;
    grade_band: string;
    language: string;
    class_code: string;
    enrol_token: string;
  }

  interface OrgView {
    id: string;
    name: string;
    kind: 'school' | 'club';
    verified: boolean;
    role: Org['role'];
    /** The "make a class" form for this organisation. */
    form: { name: string; band: string; language: string };
  }
  let orgs = $state<OrgView[]>([]);
  let classes = $state<ClassRow[]>([]);
  let learners = $state<Record<string, number>>({});
  let waiting = $state<Record<string, number>>({});
  let qr = $state<Record<string, string>>({});
  let loading = $state(true);
  let busy = $state(false);
  let message = $state('');
  let error = $state('');
  let copied = $state('');

  let form = $state<OrganisationForm>({
    kind: 'school',
    name: '',
    province: '',
    emis: '',
    registered: true,
    registerNo: ''
  });

  const count = (rows: { class_id: string }[]) =>
    rows.reduce<Record<string, number>>(
      (m, r) => ({ ...m, [r.class_id]: (m[r.class_id] ?? 0) + 1 }),
      {}
    );

  async function load() {
    const [o, c, l, w] = await Promise.all([
      client.select<Org>('organisation_staff', 'role,organisations(id,name,kind,verified_at)'),
      client.select<ClassRow>(
        'classes',
        'id,organisation_id,name,grade_band,language,class_code,enrol_token',
        'order=created_at'
      ),
      client.select<{ class_id: string }>('class_learners', 'class_id'),
      client.select<{ class_id: string }>('pending_enrolments', 'class_id')
    ]);
    const before = new Map(orgs.map((x) => [x.id, x.form]));
    orgs = o.flatMap((x) =>
      x.organisations
        ? [
            {
              id: x.organisations.id,
              name: x.organisations.name,
              kind: x.organisations.kind,
              verified: x.organisations.verified_at !== null,
              role: x.role,
              form: before.get(x.organisations.id) ?? {
                name: '',
                band: '3-4',
                language: languages[0]?.code ?? 'en'
              }
            }
          ]
        : []
    );
    classes = c;
    learners = count(l);
    waiting = count(w);
  }

  onMount(async () => {
    try {
      await load();
    } catch {
      error = t('account_error');
    } finally {
      loading = false;
    }
  });

  async function run(work: () => Promise<void>) {
    busy = true;
    error = '';
    message = '';
    try {
      await work();
      await load();
    } catch (err) {
      // The database explains what's wrong in plain words (e.g. the trial limits).
      error = err instanceof Error && err.message ? err.message : t('account_error');
    } finally {
      busy = false;
    }
  }

  const register = (e: SubmitEvent) => {
    e.preventDefault();
    const problems = organisationProblems(form);
    if (problems.length) {
      error = problems.map(t).join(' ');
      return;
    }
    return run(async () => {
      await client.rpc('register_organisation', registerArgs(form));
      message = t('account_org_registered_ok');
      form = { ...form, name: '', emis: '', registerNo: '' };
    });
  };

  const makeClass = (e: SubmitEvent, org: OrgView) => {
    e.preventDefault();
    return run(async () => {
      await client.rpc('create_class', {
        p_org: org.id,
        p_name: org.form.name.trim(),
        p_grade_band: org.form.band,
        p_language: org.form.language
      });
      org.form.name = '';
    });
  };

  const endClass = (id: string) => {
    if (!confirm(t('account_class_end_confirm'))) return;
    return run(async () => {
      await client.rpc('end_class', { p_class: id });
    });
  };

  async function showQr(c: ClassRow) {
    if (qr[c.id]) return;
    // The QR code library loads only here, when a teacher opens a class.
    const { default: qrcode } = await import('qrcode-generator');
    const code = qrcode(0, 'M');
    code.addData(enrolLink(location.origin, c.enrol_token));
    code.make();
    qr[c.id] = code.createDataURL(6, 8);
  }

  async function copy(c: ClassRow) {
    try {
      await navigator.clipboard.writeText(enrolLink(location.origin, c.enrol_token));
      copied = c.id;
    } catch {
      copied = '';
    }
  }
</script>

<section aria-labelledby="orgs-title" class="orgs">
  <h2 id="orgs-title">{t('account_orgs_title')}</h2>
  {#if loading}
    <p>{t('account_loading')}</p>
  {:else}
    {#if orgs.length === 0}<p>{t('account_orgs_none')}</p>{/if}
    {#each orgs as org (org.id)}
      <article class="org">
        <h3>{org.name}</h3>
        <p class="muted">
          {org.kind === 'school' ? t('account_org_school') : t('account_org_club')} ·
          {t(`account_role_${org.role}`)} ·
          {org.verified ? t('account_org_verified') : t('account_org_waiting')}
        </p>
        {#each classes.filter((c) => c.organisation_id === org.id) as c (c.id)}
          <details
            class="class"
            ontoggle={(e) => (e.currentTarget as HTMLDetailsElement).open && showQr(c)}
          >
            <summary>
              {c.name} · {c.grade_band} · {t('account_class_learners')}: {learners[c.id] ?? 0}
              {#if waiting[c.id]}· {t('account_class_waiting')}: {waiting[c.id]}{/if}
            </summary>
            <p>
              {t('account_class_code')}: <strong class="code">{spacedCode(c.class_code)}</strong>
            </p>
            <p>{t('account_class_link')}:</p>
            <p class="link">{enrolLink(location.origin, c.enrol_token)}</p>
            <p class="actions">
              <button type="button" class="button" onclick={() => copy(c)}>
                {copied === c.id ? t('account_class_copied') : t('account_class_copy')}
              </button>
              <a
                class="plain"
                href={whatsappShare(
                  `${t('account_class_share_text')} ${c.name}: ${enrolLink(location.origin, c.enrol_token)}`
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('account_class_whatsapp')}
              </a>
            </p>
            {#if qr[c.id]}
              <img class="qr" src={qr[c.id]} alt={t('account_class_qr')} width="200" height="200" />
            {/if}
            <p>
              <button
                type="button"
                class="plain danger"
                disabled={busy}
                onclick={() => endClass(c.id)}
              >
                {t('account_class_end')}
              </button>
            </p>
          </details>
        {/each}
        <form onsubmit={(e) => makeClass(e, org)}>
          <h4>{t('account_class_new')}</h4>
          <label for={`cls-name-${org.id}`}>{t('account_class_name')}</label>
          <input
            id={`cls-name-${org.id}`}
            required
            minlength="2"
            maxlength="60"
            bind:value={org.form.name}
          />
          <label for={`cls-band-${org.id}`}>{t('account_class_grades')}</label>
          <select id={`cls-band-${org.id}`} bind:value={org.form.band}>
            {#each GRADE_BANDS as b (b)}<option value={b}>
                {b === 'mixed' ? t('account_grades_mixed') : b}
              </option>{/each}
          </select>
          <label for={`cls-lang-${org.id}`}>{t('account_class_language')}</label>
          <select id={`cls-lang-${org.id}`} bind:value={org.form.language}>
            {#each languages as l (l.code)}<option value={l.code}>{l.native}</option>{/each}
          </select>
          <button class="button" type="submit" disabled={busy}>
            {t('account_class_create')}
          </button>
        </form>
      </article>
    {/each}

    <details class="register">
      <summary>{t('account_org_register_title')}</summary>
      <form onsubmit={register}>
        <fieldset>
          <legend>{t('account_org_kind')}</legend>
          <label class="check">
            <input type="radio" value="school" bind:group={form.kind} />
            {t('account_org_school')}
          </label>
          <label class="check">
            <input type="radio" value="club" bind:group={form.kind} />
            {t('account_org_club')}
          </label>
        </fieldset>
        <label for="org-name">{t('account_org_name')}</label>
        <input id="org-name" required minlength="2" maxlength="120" bind:value={form.name} />
        <label for="org-province">{t('account_org_province')}</label>
        <select id="org-province" bind:value={form.province}>
          <option value="">—</option>
          {#each PROVINCES as p (p)}<option value={p}>{p}</option>{/each}
        </select>
        {#if form.kind === 'school'}
          <label for="org-emis">{t('account_org_emis')}</label>
          <input
            id="org-emis"
            inputmode="numeric"
            pattern={'[0-9]{6,12}'}
            required
            bind:value={form.emis}
          />
        {:else}
          <label class="check">
            <input type="checkbox" bind:checked={form.registered} />
            {t('account_org_registered')}
          </label>
          {#if form.registered}
            <label for="org-reg">{t('account_org_register_no')}</label>
            <input id="org-reg" required maxlength="40" bind:value={form.registerNo} />
          {/if}
        {/if}
        <button class="button" type="submit" disabled={busy}>
          {t('account_org_register_button')}
        </button>
      </form>
    </details>
  {/if}
  {#if message}<p class="message" role="status">{message}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .orgs form {
    display: grid;
    gap: var(--space-2);
    max-width: 24rem;
    margin-block: var(--space-4);
  }
  .orgs input,
  .orgs select {
    font: inherit;
    padding: 0.6rem;
    min-height: 44px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  .org {
    margin-block: var(--space-6);
  }
  .class,
  .register {
    margin-block: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }
  summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .code {
    font-size: 1.25rem;
    letter-spacing: 0.1em;
  }
  .link {
    overflow-wrap: anywhere;
    font-size: 0.875rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    align-items: center;
  }
  .orgs button {
    min-height: 44px;
    font: inherit;
    cursor: pointer;
  }
  .orgs .button {
    border: 0;
    justify-content: center;
    font-weight: 600;
  }
  .orgs .plain {
    border: 0;
    background: none;
    color: var(--color-link, inherit);
    text-decoration: underline;
    padding: 0;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .danger {
    color: var(--color-error, #b3261e);
  }
  .check {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 44px;
  }
  .qr {
    display: block;
    image-rendering: pixelated;
    background: #fff;
  }
  .error {
    color: var(--color-error, #b3261e);
  }
</style>
