// ADR-0012: the back office merges a pull request itself only when all four hold, checked just
// before merging: (1) the App opened it, from an admin/ branch, into main; (2) it changes only the
// status lines of one lesson, lesson translation, Machines topic or world file, one language's entry, or one
// item of the withdrawn list; (3) CI passed on its latest commit; (4) the decision it carries was
// recorded in the back office by a person with the right role. Anything else waits for a person
// on GitHub.
import type { GitHub, Pull } from './github';
import { onlyStatusChanged } from './lessons';
import { onlyWorldStatusChanged } from './worlds';
import { onlyBadgeStatusChanged } from './badges';
import { onlyLanguageStatusChanged } from './language-review';
import { LANGUAGES_PATH } from './languages';
import { TRANSLATION_FILE } from './translation-files';
import { oneItemChanged } from '../../../../packages/settings/src/withdrawn';

export const WITHDRAWN_PATH = 'content/site/withdrawn.json';

const LESSON_FILE = /^content\/lessons\/[a-z0-9]+(?:-[a-z0-9]+)*\/index\.md$/;
const WORLD_FILE = /^content\/worlds\/[a-z]+(?:-[a-z]+)*\.json$/;
const BADGE_FILE = /^content\/badges\/[a-z]+(?:-[a-z]+)*\.json$/;
const MACHINE_FILE = /^content\/machines\/[a-z]+(?:-[a-z]+)*\/index\.md$/;

export interface MergeCheck {
  ok: boolean;
  /** What is still missing, in plain words (empty when ok). */
  waiting: string[];
  pull: Pull;
}

export async function checkMerge(
  gh: GitHub,
  number: number,
  opts: {
    /** The App's own GitHub login, e.g. "robots-for-all-back-office[bot]". */
    appLogin: string;
    /** Was this pull request's decision recorded in the back office? (database) */
    decided: (url: string) => Promise<boolean>;
  }
): Promise<MergeCheck> {
  const pull = await gh.getPull(number);
  const waiting: string[] = [];

  // (1) Our own pull request, still open, from an admin/ branch into main.
  if (pull.state !== 'open') waiting.push('the pull request is not open');
  if (pull.user.login !== opts.appLogin) waiting.push('it was not opened by the back office');
  if (!pull.head.ref.startsWith('admin/')) waiting.push('it is not from a back-office branch');
  if (pull.base.ref !== 'main') waiting.push('it does not go into main');

  // (2) One file: a lesson whose status lines alone changed, or the withdrawn list with exactly
  // one item added or removed (more content spec §2.4), compared with main now.
  const files = await gh.pullFiles(number);
  const [file] = files;
  const kind =
    files.length === 1 && file?.status === 'modified'
      ? LESSON_FILE.test(file.filename) ||
        TRANSLATION_FILE.test(file.filename) ||
        MACHINE_FILE.test(file.filename)
        ? 'lesson'
        : WORLD_FILE.test(file.filename)
          ? 'world'
          : BADGE_FILE.test(file.filename)
            ? 'badge'
            : file.filename === WITHDRAWN_PATH
              ? 'withdrawn'
              : file.filename === LANGUAGES_PATH
                ? 'language'
                : null
      : null;
  if (!file || !kind) {
    waiting.push(
      'it changes more than one content file (lesson, translation, Machines topic, world, badge, language status or the withdrawn list)'
    );
  } else {
    const [before, after] = await Promise.all([
      gh.readFile(file.filename, 'main'),
      gh.readFile(file.filename, pull.head.sha)
    ]);
    const ok =
      kind === 'lesson'
        ? onlyStatusChanged(before.text, after.text)
        : kind === 'world'
          ? onlyWorldStatusChanged(before.text, after.text)
          : kind === 'badge'
            ? onlyBadgeStatusChanged(before.text, after.text)
            : kind === 'language'
              ? onlyLanguageStatusChanged(before.text, after.text)
              : (() => {
                  try {
                    return oneItemChanged(JSON.parse(before.text), JSON.parse(after.text));
                  } catch {
                    return false;
                  }
                })();
    if (!ok) {
      waiting.push(
        kind !== 'withdrawn'
          ? 'it changes more than the status lines (or main changed meanwhile)'
          : 'it changes more than one item of the withdrawn list (or main changed meanwhile)'
      );
    }
  }

  // (3) CI on the latest commit.
  const ci = await gh.checks(pull.head.sha);
  if (ci === 'running') waiting.push('the automatic checks are still running');
  if (ci === 'failed') waiting.push('the automatic checks failed');

  // (4) The decision was recorded in the back office.
  if (!(await opts.decided(pull.html_url))) waiting.push('no decision is recorded for it');

  return { ok: waiting.length === 0, waiting, pull };
}

/** Merges only after checkMerge passes; the head commit must still be the one checked. */
export async function mergeIfReady(
  gh: GitHub,
  number: number,
  opts: Parameters<typeof checkMerge>[2]
): Promise<MergeCheck> {
  const check = await checkMerge(gh, number, opts);
  if (check.ok) await gh.merge(number, check.pull.head.sha, check.pull.title);
  return check;
}
