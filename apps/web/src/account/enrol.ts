// Enrolment by a parent (M5 step 4a, spec FR-5 to FR-10): the class's link carries its token
// after #, so it never reaches a server log. Consent is given here, online, by the parent.

/** The version of the notice parents read; recorded with each consent (spec §7.2). */
export const NOTICE_VERSION = '1.0';

/** Pictures a child can choose to show next to their nickname. */
export const AVATARS = [
  { id: 'robot', emoji: '🤖' },
  { id: 'rhino', emoji: '🦏' },
  { id: 'rocket', emoji: '🚀' },
  { id: 'star', emoji: '⭐' },
  { id: 'gear', emoji: '⚙️' },
  { id: 'bird', emoji: '🐦' }
] as const;

/** The class's enrolment token in this page's address, if it looks right. */
export const enrolTokenFromHash = (hash: string): string | null =>
  /^#([0-9a-f]{32})$/.exec(hash)?.[1] ?? null;

/** Problems with the child's details (keys of interface words), before asking the database. */
export function childProblems(c: { nickname: string; grade: number }): string[] {
  const out: string[] = [];
  const n = c.nickname.trim();
  if (n.length < 2 || n.length > 20) out.push('enrol_nickname_length');
  // A nickname, not a full name: two or more words each starting with a capital look like one.
  if (/^\p{Lu}\p{Ll}+(\s+\p{Lu}\p{Ll}+)+$/u.test(n)) out.push('enrol_nickname_not_full_name');
  if (!Number.isInteger(c.grade) || c.grade < 1 || c.grade > 12) out.push('enrol_grade_needed');
  return out;
}
