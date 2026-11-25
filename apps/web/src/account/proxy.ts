// Account data through our own domain (ADR-0017): the browser calls /db/…, a Cloudflare Pages
// Function forwards an allowed request to Supabase. So the site keeps connect-src 'self', stays
// on the zero-rated hostname, and the Supabase key is added by the server, not shipped in pages.

/** Sign-in calls (Supabase Auth): one-time codes by email for now (ADR-0016 adds WhatsApp/SMS). */
const AUTH: Record<string, readonly string[]> = {
  otp: ['POST'],
  verify: ['POST'],
  token: ['POST'],
  logout: ['POST'],
  user: ['GET']
};

/** Database functions an adult or learner session may call; each checks its own rules (0010). */
export const RPC = new Set([
  'touch_adult',
  'register_organisation',
  'add_staff',
  'create_staff_invitation',
  'accept_staff_invitation',
  'revoke_staff_invitation',
  'organisation_staff_list',
  'remove_staff',
  'create_class',
  'end_class',
  'rename_learner',
  'remove_from_class',
  'enrol_child',
  'link_child',
  'confirm_enrolment',
  'withdraw_consent',
  'delete_learner',
  'my_children_classes',
  'reset_learner_pin',
  'revoke_learner_sessions',
  'cancel_pending_enrolment',
  'class_learner_status',
  'create_sign_in_cards',
  'revoke_sign_in_cards',
  'check_record',
  'revoke_badge',
  'verify_certificate',
  'has_certificate_name'
]);

/** Tables the account pages read (row-level security decides which rows). */
export const TABLES = new Set([
  'adults',
  'organisations',
  'organisation_staff',
  'classes',
  'class_staff',
  'learners',
  'learner_guardians',
  'class_learners',
  'consents',
  'pending_enrolments',
  'sheet_records',
  'badge_awards',
  'staff_invitations'
]);

/** Tables a session may write directly: only a learner's own sheet records (ADR-0014). */
const WRITABLE = new Set(['sheet_records']);

/**
 * The Supabase path for an allowed request, or null. `path` is what follows /db/, e.g.
 * "auth/v1/otp" or "rest/v1/rpc/create_class".
 */
export function allowedPath(method: string, path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.some((p) => p === '..' || p.includes('%'))) return null;
  const [service, version, first, second, ...more] = parts;
  if (version !== 'v1' || more.length > 0) return null;
  if (service === 'auth' && first && second === undefined) {
    return AUTH[first]?.includes(method) ? `auth/v1/${first}` : null;
  }
  if (service !== 'rest' || !first) return null;
  if (first === 'rpc') {
    return method === 'POST' && second && RPC.has(second) ? `rest/v1/rpc/${second}` : null;
  }
  if (second !== undefined || !TABLES.has(first)) return null;
  if (method === 'GET') return `rest/v1/${first}`;
  if ((method === 'POST' || method === 'PATCH') && WRITABLE.has(first)) return `rest/v1/${first}`;
  return null;
}

/** Request headers passed on: never cookies or anything identifying beyond the session token. */
export const FORWARDED_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'prefer',
  'range',
  'accept-profile',
  'content-profile'
] as const;
