// Withdrawn content (more content spec §2.4): items in content/site/withdrawn.json are left out
// of production; the drafts preview keeps them, labelled. Works at build time and in the browser.
import raw from '../../../content/site/withdrawn.json';
import {
  buildWithdrawn,
  isWithdrawn,
  type WithdrawType
} from '../../../packages/settings/src/withdrawn';

export const withdrawn = buildWithdrawn(raw);

/** Is this item withdrawn (whatever the build)? */
export const isOff = (type: WithdrawType, id: string): boolean => isWithdrawn(withdrawn, type, id);

/** Should this build leave the item out? Production yes; the drafts preview no. */
export const hidden = (type: WithdrawType, id: string): boolean =>
  !__RFA_SHOW_DRAFTS__ && isOff(type, id);
