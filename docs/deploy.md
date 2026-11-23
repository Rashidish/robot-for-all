# Deploying Robot For All

The site is plain static files hosted on **Cloudflare Pages** (ADR-0002). GitHub Actions builds and publishes it (`.github/workflows/deploy.yml`):

| Event | Goes to | Lessons shown |
|---|---|---|
| Merge to `main` | Production (your domain) | Only `published` lessons that a person has reviewed |
| Pull request from this repo | A private preview URL | Drafts too, marked "Draft" |

Deployment stays switched off until the two secrets below exist; until then the workflow just leaves a notice.

## One-time setup (owner)

### 1. Cloudflare account
1. Sign up at dash.cloudflare.com (free plan) and turn on two-factor authentication.
2. Copy your **Account ID**: Account home → the **⋯** menu next to your account name → **Copy account ID**, or Compute → Workers & Pages, right-hand panel.

You don't need to create the Pages project: the first deploy creates `robot-for-all` automatically.

The GitHub repo is `robots-for-all` (renamed 2026-11-23). The Cloudflare Pages project, and so the address robot-for-all.pages.dev, keeps its old name until the site moves to the robotsforall domains; renaming it would create a new, empty site.

### 2. API token for GitHub
1. Profile icon (top right) → **Profile → API Tokens → Create Token → Create Custom Token → Get started**.
2. Name: `GitHub deploy`. Permissions: **Account → Cloudflare Pages → Edit**. Nothing else.
3. Account resources: **Include → your account**. Set an expiry (e.g. 12 months).
4. **Continue to summary → Create Token**, then copy it (shown once).

### 3. Add the secrets to GitHub
**github.com/Rashidish/robots-for-all → Settings → Secrets and variables → Actions → New repository secret**:
- `CLOUDFLARE_API_TOKEN`: the token from step 2
- `CLOUDFLARE_ACCOUNT_ID`: the Account ID from step 1

The next merge to `main` creates the project and publishes the site to `robot-for-all.pages.dev`.

### 4. Your domain
1. Register the domain (registrar lock and two-factor on).
2. In the Pages project: **Custom domains → Set up a custom domain**, e.g. `learn.<your-domain>`. Use **one hostname for everything** (zero-rating, ADR-0002).
3. Follow Cloudflare's DNS instructions. HTTPS is automatic.
4. Once live on the final hostname, apply for zero-rating via Vodacom ConnectU (then MTN, Telkom, Cell C).

## Security notes
- The token can only deploy Pages; it can't change DNS or anything else.
- Secrets are never exposed to pull requests from forks.
- Security headers come from `apps/web/public/_headers` and are tested in CI.
- To roll back: Cloudflare dashboard → the project → **Deployments** → pick an earlier one → **Rollback**.
