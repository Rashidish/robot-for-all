# Deploying Robots For All

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

### 4. The domains (decided 2026-11-23)
The whole site (lessons, code editor, on-screen micro:bit) lives on **one hostname: `robotsforall.org.za`**
(ADR-0002: Vodacom zero-rates by hostname). Every other address redirects to it permanently:

| Address | What it does |
|---|---|
| `robotsforall.org.za` | The site |
| `www.robotsforall.org.za` | Redirects to `robotsforall.org.za` |
| `robotsforall.co.za`, `www.robotsforall.co.za` | Redirect to `robotsforall.org.za` |
| `robotsforall.africa`, `www.robotsforall.africa` | Redirect to `robotsforall.org.za` |

Steps (Cloudflare dashboard; the GitHub token can't do these, by design):
1. At each registrar: registrar lock and two-factor on.
2. **Add the three domains to Cloudflare** (Websites → Add a domain → Free plan) and change each
   domain's nameservers at its registrar to the two Cloudflare gives you. Wait until Cloudflare shows
   the domain as **Active** (minutes to a day). For `.org.za` and `.co.za`, the registrar submits the
   change to ZADNA's registry; `.africa` the same through its registry.
3. **Connect the site:** Workers & Pages → `robot-for-all` → **Custom domains → Set up a custom domain** →
   `robotsforall.org.za`. Cloudflare adds the DNS record and HTTPS certificate itself. The project keeps
   its old name (renaming it would create a new, empty site); nobody sees it once the domain is on.
4. **Redirects:** for `www.robotsforall.org.za` and each of the other two domains (and their `www.`):
   add a proxied DNS record (`A` record, name `@` or `www`, IPv4 `192.0.2.1`, orange cloud on), then
   Rules → **Redirect Rules** → *Redirect from one domain to another* (or a custom rule: all incoming
   requests → dynamic `concat("https://robotsforall.org.za", http.request.uri.path)`, **301**, keep the
   query string). `192.0.2.1` is a placeholder address; the redirect answers before it is ever used.
5. **Tell the deploy checks:** github.com/Rashidish/robots-for-all → Settings → Secrets and variables →
   Actions → **Variables** → New repository variable `SITE_URL` = `https://robotsforall.org.za`. Until it
   is set, the checks after each merge use `robot-for-all.pages.dev`.
6. Check: `https://robotsforall.org.za/` loads, installs as an app and works offline;
   `https://robotsforall.africa/code/` lands on `https://robotsforall.org.za/code/`.
7. Once live, apply for zero-rating of `robotsforall.org.za` via **Vodacom ConnectU** (then MTN, Telkom,
   Cell C). Everything the site loads already comes from this one hostname.

Learners who installed the app from `robot-for-all.pages.dev` keep that copy working; the new address is a
new install (browsers keep apps per address). Before the public launch, tell pilot users to open the new
address once.

## Security notes
- The token can only deploy Pages; it can't change DNS or anything else.
- Secrets are never exposed to pull requests from forks.
- Security headers come from `apps/web/public/_headers` and are tested in CI.
- To roll back: Cloudflare dashboard → the project → **Deployments** → pick an earlier one → **Rollback**.
