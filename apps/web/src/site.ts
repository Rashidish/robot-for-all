// Site settings (back-office spec §6.7): content/site/settings.json, built into the static site.
// A bad file fails the build. Changed from the back office through a pull request.
import raw from '../../../content/site/settings.json';
import { buildSettings, type Feature } from '../../../packages/settings/src/site';

export const site = buildSettings(raw);

/** Is this part of the public site switched on? */
export const featureOn = (f: Feature): boolean => site.features[f];
