// The GitHub App from the Worker's secrets, or null while the owner hasn't set it up yet.
import {
  GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY,
  GITHUB_INSTALLATION_ID,
  GITHUB_REPO
} from 'astro:env/server';
import { GitHub } from './github';

export function githubFromEnv(): GitHub | null {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) return null;
  return new GitHub({
    appId: GITHUB_APP_ID,
    // Secrets set from a shell often keep "\n" as two characters.
    privateKey: GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    installationId: GITHUB_INSTALLATION_ID,
    repo: GITHUB_REPO
  });
}
