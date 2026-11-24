// Back-office roles (docs/specs/back-office.md §3, ADR-0010). The database enforces every rule;
// this file only decides what the pages show, so admins aren't offered buttons that would fail.

export const ROLES = [
  'super_admin',
  'owner',
  'content_editor',
  'reviewer',
  'build_tester',
  'translator',
  'competition_manager',
  'judge',
  'moderator',
  'coach_verifier',
  'shop_manager',
  'communications',
  'support',
  'data_protection_officer'
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super admin',
  owner: 'Owner',
  content_editor: 'Content editor',
  reviewer: 'Reviewer',
  build_tester: 'Build tester',
  translator: 'Translator',
  competition_manager: 'Competition manager',
  judge: 'Judge',
  moderator: 'Moderator',
  coach_verifier: 'Coach verifier',
  shop_manager: 'Shop manager',
  communications: 'Communications',
  support: 'Support',
  data_protection_officer: 'Data protection officer'
};

export const isRole = (v: unknown): v is Role =>
  typeof v === 'string' && (ROLES as readonly string[]).includes(v);

/** A super admin has every role (as in the database's has_role). */
export const hasRole = (mine: readonly Role[], role: Role): boolean =>
  mine.includes('super_admin') || mine.includes(role);

/** The roles this person may give or take away: owners all below owner; super admins all. */
export function grantableRoles(mine: readonly Role[]): Role[] {
  if (mine.includes('super_admin')) return [...ROLES];
  if (mine.includes('owner')) return ROLES.filter((r) => r !== 'super_admin' && r !== 'owner');
  return [];
}

/** Owners and super admins see the roles screen and the audit log. */
export const canManagePeople = (mine: readonly Role[]): boolean => hasRole(mine, 'owner');

/** Season dates: competition managers and owners (docs/specs/back-office.md §6.5). */
export const canEditSeasons = (mine: readonly Role[]): boolean =>
  hasRole(mine, 'competition_manager') || hasRole(mine, 'owner');

/** The Lessons screens: content editors, reviewers, build testers and owners. */
export const canSeeLessons = (mine: readonly Role[]): boolean =>
  (['content_editor', 'reviewer', 'build_tester', 'owner'] as const).some((r) => hasRole(mine, r));

/** Withdraw and restore (more content spec §2.4): owners, reviewers, competition managers. */
export const canWithdraw = (mine: readonly Role[]): boolean =>
  (['owner', 'reviewer', 'competition_manager'] as const).some((r) => hasRole(mine, r));

/** Competition managers may withdraw only worlds and seasons. */
export const withdrawTypesFor = (
  mine: readonly Role[]
): ('lesson' | 'template' | 'world' | 'season' | 'language')[] =>
  hasRole(mine, 'owner') || hasRole(mine, 'reviewer')
    ? ['lesson', 'template', 'world', 'season', 'language']
    : hasRole(mine, 'competition_manager')
      ? ['world', 'season']
      : [];

/** Content → Languages: owners, translators and reviewers see it; only owners add or remove. */
export const canSeeLanguages = (mine: readonly Role[]): boolean =>
  (['owner', 'translator', 'reviewer'] as const).some((r) => hasRole(mine, r));
