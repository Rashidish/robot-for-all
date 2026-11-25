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

### 5. The back office (ADR-0009, ADR-0010, ADR-0011)

The back office is a separate **Cloudflare Worker** (`robots-for-all-admin`) on
`admin.robotsforall.org.za`, behind **Cloudflare Access**. It is never part of the public site.
Do these once, in this order:

1. **Supabase:** create a project (free plan, the region nearest South Africa). Turn on
   **Authentication → Multi-factor → TOTP**. Apply `packages/db/migrations/*.sql` in order and set
   up the first super admin and the vaulted break-glass account (`packages/db/README.md`).
2. **Cloudflare Access:** Zero Trust (free plan) → **Access → Applications → Add → Self-hosted**:
   domain `admin.robotsforall.org.za`, a policy that **allows only the admin email addresses**,
   login method **One-time PIN**. Copy the application's **AUD tag** and your **team name**
   (the `<team>` in `<team>.cloudflareaccess.com`).
3. **A deploy token for the Worker:** My Profile → API Tokens → Create Token → *Edit Cloudflare
   Workers* template; keep only this account and the `robotsforall.org.za` zone. Add it to GitHub
   as the secret **`CLOUDFLARE_ADMIN_API_TOKEN`** (separate from the Pages token, so each can do
   only its own job). If the first deploy says it can't attach the custom domain, add
   **Zone → DNS → Edit** for `robotsforall.org.za` to this token only.
4. **Worker secrets** (on your computer, once, from `apps/admin`; values never go into the repo):
   ```
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put ACCESS_TEAM
   npx wrangler secret put ACCESS_AUD
   ```
5. **Switch the deploy on:** GitHub → Settings → Secrets and variables → Actions → **Variables** →
   `ADMIN_DEPLOY` = `true`. The next push to `main` deploys the Worker, attaches the custom domain,
   creates its small KV store (`SESSION`) and checks that the live site refuses requests without
   Access.
6. **The GitHub App** (lets the back office open pull requests, e.g. new season dates):
   github.com → Settings → Developer settings → **GitHub Apps → New GitHub App**: name
   "Robots For All back office", no webhook, permissions **Contents: Read and write**,
   **Pull requests: Read and write** (Metadata: Read is automatic), "Only on this account".
   Create it, note the **App ID**, **Generate a private key**, then **Install App** on
   `Rashidish/robots-for-all` **only** and note the installation id (the number at the end of the
   installation's settings URL). GitHub gives the key as PKCS#1; convert it once on your computer
   and store it as a Worker secret, then delete the downloaded file:
   ```
   openssl pkcs8 -topk8 -nocrypt -in downloaded-key.pem -out app-key.pem
   npx wrangler secret put GITHUB_APP_ID
   npx wrangler secret put GITHUB_INSTALLATION_ID
   npx wrangler secret put GITHUB_APP_PRIVATE_KEY < app-key.pem
   ```
7. **Protect `main`** with **two** rulesets (repository → Settings → Rules → New branch ruleset,
   target `main`), because a bypass applies to a whole ruleset:
   - **"CI for everyone"**: require status checks to pass (the CI jobs), block force pushes and
     deletion; **bypass list empty**, so nobody, the App included, merges red.
   - **"A person approves"**: require a pull request with 1 approval; bypass list: **only the
     back-office App**. The back office still merges only its own status-only pull requests after
     a recorded decision and green CI (ADR-0012); everything else needs a person on GitHub.
   Give the App these permissions: Contents and Pull requests **Read and write**, Checks **Read**.
   Set its login as a Worker secret (it is the App's name in lower case with `[bot]`, e.g.
   `robots-for-all-back-office[bot]`): `npx wrangler secret put GITHUB_APP_LOGIN`.
8. **Drafts preview** (content review spec §6.2): pushes to `main` also deploy a copy with drafts
   to the Pages branch `drafts`. In Workers & Pages → `robot-for-all` → **Settings → General →
   Access policy: Enable for preview deployments** (this also covers pull request previews,
   which show drafts). Then add the custom domain `drafts.robotsforall.org.za` as a CNAME to
   `drafts.robot-for-all.pages.dev`, and add it to the same Cloudflare Access application as the
   back office.
9. **Sign in:** open `admin.robotsforall.org.za`, pass Access with the emailed PIN, sign in with
   your Supabase account and set up your authenticator app.

Without `ACCESS_TEAM` and `ACCESS_AUD` the app refuses every request, and without the Supabase
secrets it shows an error: it never opens by accident.

### 6. Accounts (M5, ADR-0017)
Accounts stay off until the site switch **accounts** is on (back office → Site). Before switching it on:
1. In Cloudflare → **Workers & Pages → robot-for-all → Settings → Variables and secrets**, add for Production and Preview:
   - `SUPABASE_URL`: the project URL from Supabase → Settings → API (the same project as the back office);
   - `SUPABASE_ANON_KEY` (as a **secret**): the project's public "anon" key from the same page. The service key is never used here.
2. In Supabase → **Authentication → Providers → Email**: email sign-in on, "Confirm email" on; **Email templates → Magic Link**: show the `{{ .Token }}` code (our sign-in page asks for the code, not a link).
3. Apply the M5 migrations, `0010_teach.sql` onwards, in order (packages/db/README.md).
4. Update the privacy page for M5 (M5 spec §7.1) before switching **accounts** on.
5. Give the **Data protection officer** role (back office → People) to whoever confirms deletions (the Information Officer, or someone they name). Only that role sees Privacy → Due for deletion.

`/db/` answers 503 until step 1 is done, so nothing breaks before then.

### 7. The certificate service and the name key (M5, ADR-0015)
A small **Cloudflare Worker** (`robots-for-all-cert`, `apps/cert`) answers `robotsforall.org.za/cert/*`.
It is the only thing that holds the **name key**: it locks (encrypts) the names parents give for
certificates and unlocks them only for a certificate, a badge, or a class's teacher who taps
**Show names**. Until it is set up, `/cert/` does not answer and the name form says it could not save.
Do these once, in this order:

1. **Make the key** on your own computer (never on a shared one), and keep the output only in the vault:
   ```
   node -e "console.log(JSON.stringify({ 1: require('crypto').randomBytes(32).toString('base64') }))"
   ```
   It prints something like `{"1":"q3…="}`. That whole line is the key.
2. **Vault it, twice:** save the line in your password-manager vault (item "Robots For All name key v1"),
   and give a sealed printed copy to a second trusted person. **If every copy is lost, the names can't be
   recovered** and parents would have to add them again.
3. **Worker secrets** (from `apps/cert`; you paste each value when asked):
   ```
   npx wrangler secret put NAME_KEYS
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put SUPABASE_SERVICE_KEY
   ```
   `SUPABASE_SERVICE_KEY` is the project's **service_role** key (Supabase → Settings → API). It lives only
   here, never in the Pages project, the back office or the repository. Then clear the key from your
   clipboard and your terminal history.
4. **Deploy token:** reuse `CLOUDFLARE_ADMIN_API_TOKEN` (it can edit Workers on this zone).
5. **Switch the deploy on:** GitHub → Settings → Secrets and variables → Actions → **Variables** →
   `CERT_DEPLOY` = `true`. The next push to `main` deploys the Worker on its route and checks that
   `/cert/` refuses a request without a sign-in.

**A new key each year** (or at once if a leak is suspected): make key 2 the same way, set `NAME_KEYS` to
`{"1":"…old…","2":"…new…"}` and `NAME_KEY_CURRENT` to `2` in `apps/cert/wrangler.jsonc`. New names use
key 2; old ones still unlock with key 1 until they are re-locked (a later step), after which key 1 is
removed. Vault every version until it is removed.

Logs are switched off for this Worker (`observability` false), so no request, error or name is kept.

**Email to parents** (school and club enrolment, M5 FR-5a) also goes through this service. Until an email provider is chosen and its adapter added (`apps/cert/src/mail.ts`, owner action 5 in the M5 spec), the service refuses school enrolments and keeps nothing; parents can still enrol with the class link. Once chosen, set `EMAIL_PROVIDER` and the provider's key as secrets here.

**The daily job** runs on this Worker every day at 03:17 South African time (Cron Trigger in `apps/cert/wrangler.jsonc`): it expires and reminds waiting school enrolments, sends dormancy warnings, runs the deletion steps (due, lock, delete; M5 spec §7.5) and emails the back office every 7 days while accounts wait. Set where that notice goes: `npx wrangler secret put PRIVACY_NOTICE_EMAIL` (the Information Officer's address). The deletion steps run even before email is set up.

## Security notes
- The Pages token can only deploy Pages; the back-office token (`CLOUDFLARE_ADMIN_API_TOKEN`) is limited to Workers (and, if needed, DNS for the admin custom domain) on this account and zone.
- Secrets are never exposed to pull requests from forks.
- Security headers come from `apps/web/public/_headers` and are tested in CI.
- To roll back: Cloudflare dashboard → the project → **Deployments** → pick an earlier one → **Rollback**.
