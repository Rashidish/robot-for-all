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
2. Note your **Account ID** (shown on the account home page, right-hand side).

### 2. Create the Pages project
1. **Workers & Pages → Create → Pages → Upload assets** ("Direct Upload").
2. Project name: **`robot-for-all`** (must match exactly).
3. Upload any small file to finish creating it; the first real deploy replaces it.

### 3. API token for GitHub
1. **My Profile → API Tokens → Create Token → Create Custom Token**.
2. Permissions: **Account → Cloudflare Pages → Edit**. Nothing else.
3. Account resources: your account only. Set an expiry date (e.g. 12 months) and renew it.
4. Copy the token (shown once).

### 4. Add the secrets to GitHub
**github.com/Rashidish/robot-for-all → Settings → Secrets and variables → Actions → New repository secret**:
- `CLOUDFLARE_API_TOKEN`: the token from step 3
- `CLOUDFLARE_ACCOUNT_ID`: the Account ID from step 1

The next merge to `main` publishes the site to `robot-for-all.pages.dev`.

### 5. Your domain
1. Register the domain (registrar lock and two-factor on).
2. In the Pages project: **Custom domains → Set up a custom domain**, e.g. `learn.<your-domain>`. Use **one hostname for everything** (zero-rating, ADR-0002).
3. Follow Cloudflare's DNS instructions. HTTPS is automatic.
4. Once live on the final hostname, apply for zero-rating via Vodacom ConnectU (then MTN, Telkom, Cell C).

## Security notes
- The token can only deploy Pages; it can't change DNS or anything else.
- Secrets are never exposed to pull requests from forks.
- Security headers come from `apps/web/public/_headers` and are tested in CI.
- To roll back: Cloudflare dashboard → the project → **Deployments** → pick an earlier one → **Rollback**.
