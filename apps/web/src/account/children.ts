// A parent's view of their children (M5 step 4c, spec FR-9, FR-10): which classes each child is
// in, and a copy of everything we keep about the child (POPIA s23, the right of access).

export interface Child {
  id: string;
  nickname: string;
  grade: number;
  avatar: string;
  language: string;
  created_at: string;
}
export interface ChildClass {
  learner_id: string;
  class_id: string;
  class_name: string;
  organisation_name: string;
}
export interface Consent {
  learner_id: string;
  control: string;
  class_id: string | null;
  notice_version: string;
  given_at: string;
  withdrawn_at: string | null;
}
export interface LearnerRow {
  learner_id: string;
  [column: string]: unknown;
}

/** Each child with the classes they are in. */
export function withClasses(children: Child[], classes: ChildClass[]) {
  return children.map((child) => ({
    ...child,
    classes: classes.filter((c) => c.learner_id === child.id)
  }));
}

/** Everything kept about one child, as a file the parent can save. */
export function portfolio(
  child: Child,
  data: {
    classes: ChildClass[];
    consents: Consent[];
    records: LearnerRow[];
    badges: LearnerRow[];
  },
  now = new Date()
) {
  const mine = <T extends { learner_id: string }>(rows: T[]) =>
    rows
      .filter((r) => r.learner_id === child.id)
      .map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'learner_id')));
  return {
    format: 'robots-for-all-portfolio',
    version: 1,
    exported_at: now.toISOString(),
    child: {
      nickname: child.nickname,
      grade: child.grade,
      avatar: child.avatar,
      language: child.language,
      enrolled_at: child.created_at
    },
    classes: data.classes
      .filter((c) => c.learner_id === child.id)
      .map((c) => ({ class: c.class_name, school_or_club: c.organisation_name })),
    consents: mine(data.consents),
    lesson_records: mine(data.records),
    badges: mine(data.badges)
  };
}

/** A safe file name for the download, e.g. "thandi-r-portfolio.json". */
export const portfolioFileName = (nickname: string): string =>
  `${
    nickname
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'child'
  }-portfolio.json`;
