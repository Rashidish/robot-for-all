// Certificates and badge cards on request (M5 FR-26 to FR-30, step 8b):
//   POST /cert/certificate   {award, kind}                 one learner's badge: their parent or
//                                                          guardian, or one of their teachers
//   POST /cert/certificates  {class, badge?, kind}         a class's badges: its teachers/coaches
// The database decides who may print what (certificates_for, migration 0023) and gives the
// encrypted name only with consent b; it is decrypted here, in memory, drawn into the PDF and
// forgotten. The PDF is sent no-store and never kept (FR-24). Its file name has no name in it.
import { decryptName, fromBytea, loadKeys } from './crypto';
import { type Deps, type Env, rpc } from './handler';
import { words } from './mail';
import { type CertificateData, drawPdf, type Fonts } from './pdf';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Larger batches are for the event batches (in the background, later). */
export const MAX_IN_ONE_PDF = 300;

interface Row {
  award_id: string;
  learner_id: string;
  badge_id: string;
  awarded_at: string;
  code: string | null;
  certificate_name: string | null;
  key_version: number | null;
  language: string;
}

const pdfReply = (bytes: Uint8Array, file: string) =>
  new Response(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${file}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
const fail = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

function dateIn(language: string, iso: string): string {
  const d = new Date(iso);
  for (const tag of [`${language}-ZA`, 'en-ZA']) {
    try {
      return d.toLocaleDateString(tag, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Johannesburg'
      });
    } catch {
      // Try the next.
    }
  }
  return iso.slice(0, 10);
}

export async function certificates(
  pathname: string,
  body: Record<string, unknown>,
  by: string,
  env: Env,
  deps: Deps,
  fonts: () => Promise<Fonts>
): Promise<Response> {
  const kind = body['kind'] === 'card' ? 'card' : 'certificate';
  const single = pathname === '/cert/certificate';
  const award = body['award'];
  const cls = body['class'];
  const badge = body['badge'];
  const language =
    typeof body['language'] === 'string' && /^[a-z]{2,3}$/.test(body['language'])
      ? body['language']
      : null;
  if (single && (typeof award !== 'string' || !UUID.test(award))) return fail(400, 'which badge?');
  if (!single && (typeof cls !== 'string' || !UUID.test(cls))) return fail(400, 'which class?');
  if (
    badge !== undefined &&
    badge !== null &&
    (typeof badge !== 'string' || !/^[a-z]+(-[a-z]+)*$/.test(badge))
  ) {
    return fail(400, 'which badge?');
  }
  const found = await rpc<Row[]>(env, deps, 'certificates_for', {
    p_by: by,
    p_award: single ? award : null,
    p_class: single ? null : cls,
    p_badge: single ? null : (badge ?? null)
  });
  if (!found.ok) return fail(found.status, found.message);
  const rows = found.body ?? [];
  if (rows.length === 0) return fail(404, single ? 'not yours to print' : 'no badges yet');
  if (rows.length > MAX_IN_ONE_PDF) return fail(413, 'too many: choose one badge');

  const keys = await loadKeys(env.NAME_KEYS);
  const site = env.SITE_URL ?? 'https://robotsforall.org.za';
  const art = new Map<string, string>();
  const items: CertificateData[] = [];
  for (const r of rows) {
    // A code for every award (older awards may not have one yet).
    let code = r.code;
    if (!code) {
      const label = await rpc<string>(env, deps, 'certificate_label', { p_learner: r.learner_id });
      const made = await rpc<string>(env, deps, 'issue_certificate_code', {
        p_award: r.award_id,
        p_label: label.ok && label.body ? label.body : 'Robots For All'
      });
      if (!made.ok || !made.body) return fail(502, 'try again');
      code = made.body;
    }
    const shown = await rpc<{ issued_by_label: string }[]>(env, deps, 'verify_certificate', {
      p_code: code
    });
    const label = (shown.ok && shown.body[0]?.issued_by_label) || 'Robots For All';
    if (!art.has(r.badge_id)) {
      const res = await deps.fetch(`${site}/badges/${r.badge_id}.svg`);
      if (!res.ok) return fail(502, 'badge picture');
      art.set(r.badge_id, await res.text());
    }
    let name: string | null = null;
    const key = r.key_version === null ? undefined : keys.get(r.key_version);
    if (r.certificate_name && key) {
      try {
        name = await decryptName(key, r.learner_id, fromBytea(r.certificate_name));
      } catch {
        name = null; // printed with a blank line, never guessed
      }
    }
    const lang = language ?? r.language;
    const w = (k: string) => words(lang, k, {});
    const id = r.badge_id.replace(/-/g, '_');
    items.push({
      name,
      badgeName: w(`badge_${id}_name`),
      badgeAbout: w(`badge_${id}_about`),
      badgeSvg: art.get(r.badge_id) ?? '',
      label,
      date: dateIn(lang, r.awarded_at),
      code,
      words: {
        title: w('cert_title'),
        awardedTo: w('cert_awarded_to'),
        forBadge: w('cert_for_badge'),
        awardedByRfa: w('verify_awarded_by_rfa'),
        check: w('cert_check')
      },
      site
    });
  }
  const pdf = await drawPdf(kind, items, await fonts());
  return pdfReply(pdf, kind === 'card' ? 'badge-cards.pdf' : 'certificates.pdf');
}
