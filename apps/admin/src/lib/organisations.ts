// People → Organisations (M5 spec §7.4): verify each school or club once. The database
// (verify_organisation, migration 0010) enforces who may verify and which routes fit; this file
// decides what the page offers, so verifiers aren't shown choices that would fail.

export type OrganisationKind = 'school' | 'club';
export type VerificationRoute =
  | 'official_email'
  | 'official_phone'
  | 'principal_letter'
  | 'register'
  | 'vouched'
  | 'references'
  | 'call_and_reference';

export const ROUTE_LABELS: Record<VerificationRoute, string> = {
  official_email: "A code sent to the organisation's official email",
  official_phone: 'A call to the official phone number (DBE list or public register)',
  principal_letter:
    "The principal's signed letter (emailed, or a WhatsApp photo confirmed by a call; not kept)",
  register: 'Registration number checked in the public register (NPO, CIPC or municipality)',
  vouched: 'Vouched for by a verified school, library or partner organisation',
  references: 'Two community references, each confirmed by phone',
  call_and_reference: 'A verification call with the club lead, plus one reference'
};

/** The routes that fit an organisation (spec §7.4), in the order to try them. */
export function routesFor(kind: OrganisationKind, registered: boolean): VerificationRoute[] {
  if (kind === 'school') return ['official_email', 'official_phone', 'principal_letter'];
  if (registered) return ['register', 'official_email', 'official_phone', 'vouched'];
  return ['vouched', 'references', 'call_and_reference'];
}

export interface OrganisationRow {
  id: string;
  kind: OrganisationKind;
  name: string;
  province: string | null;
  emis: string | null;
  register_no: string | null;
  registered: boolean;
  verified_at: string | null;
  verified_route: VerificationRoute | null;
  reverify_by: string | null;
  created_at: string;
}

export type OrganisationState = 'waiting' | 'verified' | 'recheck_due';

/** Waiting for verification, verified, or due for its re-check (spec §7.4). */
export function stateOf(o: OrganisationRow, today: string): OrganisationState {
  if (!o.verified_at) return 'waiting';
  if (o.reverify_by && o.reverify_by <= today) return 'recheck_due';
  return 'verified';
}

export const STATE_LABELS: Record<OrganisationState, string> = {
  waiting: 'Waiting for verification',
  verified: 'Verified',
  recheck_due: 'Re-check due'
};

/** What the verifier looks up first: the DBE list for schools, a public register for clubs. */
export function lookUpHint(o: OrganisationRow): string {
  if (o.kind === 'school')
    return `Look up EMIS ${o.emis ?? '(missing)'} in the DBE master list of schools; use its official phone number or email.`;
  if (o.registered)
    return `Check registration number ${o.register_no ?? '(missing)'} in the NPO register, CIPC or the municipality's list; use the contact details from the register.`;
  return 'Not registered: ask which verified school, library or partner it works with, or for two community references.';
}
