// Schools, clubs and classes on the account page (M5 step 3c). The database checks every rule
// (migration 0010); these helpers only shape the forms and links.

export const GRADE_BANDS = ['3-4', '5-6', '7-9', '10-12', 'mixed'] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape'
] as const;

export interface OrganisationForm {
  kind: 'school' | 'club';
  name: string;
  province: string;
  emis: string;
  registered: boolean;
  registerNo: string;
}

/** Problems with the register form (keys of interface words), before asking the database. */
export function organisationProblems(f: OrganisationForm): string[] {
  const out: string[] = [];
  if (f.name.trim().length < 2) out.push('account_org_name_needed');
  if (f.kind === 'school' && !/^[0-9]{6,12}$/.test(f.emis.trim()))
    out.push('account_org_emis_needed');
  if (f.kind === 'club' && f.registered && f.registerNo.trim().length < 3)
    out.push('account_org_register_needed');
  return out;
}

/** Arguments for register_organisation. */
export function registerArgs(f: OrganisationForm): Record<string, unknown> {
  return {
    p_kind: f.kind,
    p_name: f.name.trim(),
    p_province: f.province || null,
    p_emis: f.kind === 'school' ? f.emis.trim() : null,
    p_register_no: f.kind === 'club' && f.registered ? f.registerNo.trim() : null,
    p_registered: f.kind === 'school' ? true : f.registered
  };
}

/** The link parents open to enrol a child in a class (the enrolment page reads the token). */
export const enrolLink = (origin: string, token: string): string =>
  `${origin.replace(/\/$/, '')}/enrol/#${token}`;

/** The class code in two groups of three, easier to read aloud and type: "BCD FGH". */
export const spacedCode = (code: string): string => `${code.slice(0, 3)} ${code.slice(3)}`;

/** A WhatsApp share link for the enrolment message (opens WhatsApp; nothing is sent by us). */
export const whatsappShare = (text: string): string =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;
