# ADR-0002: Hosting

- **Status:** Accepted (2026-11-21)
- **Date:** 2026-11-21
- **Decider:** Rashid Ishmail

## Context
M1 ships static files only (no server code). Hosting must be:
- **Free** at our expected traffic, with no surprise bills or shutdowns if a lesson goes viral in a WhatsApp group
- **Fast in South Africa** (and later the rest of Africa)
- Able to set **custom security headers** (CSP, HSTS, etc.; M1 spec §8)
- On **our own domain** with HTTPS
- **Portable**: plain static output we can move to any host
- Compatible with **zero-rating** later (see Risks)

## Options considered

| | Cloudflare Pages | Cloudflare Workers (static assets) | GitHub Pages | Netlify (free) |
|---|---|---|---|---|
| Cost for static files | Free, unlimited requests and bandwidth | Free, static asset requests not charged | Free | Free up to 100 GB/month, then sites pause or charges apply |
| Custom headers (CSP etc.) | Yes (`_headers` file) | Yes, though some header cases need extra setup | **No** | Yes |
| Edge in South Africa | Yes | Yes | CDN, no control | Limited |
| Preview per pull request | Yes | Yes | No | Yes |
| Builds | 500/month free | Via CI | Via Actions | 300 min/month |
| Room to grow (APIs in M5–M6) | Pages Functions (Workers limits) | Native | None | Functions |

## Decision
**Cloudflare Pages**, deployed from GitHub Actions (we build in our CI, Cloudflare only hosts the files).

## Why
- The free tier serves unlimited static traffic, so popularity never takes the site down or costs money.
- `_headers` gives us the full security header set from M1 spec §8.
- Edge locations in South Africa keep lessons fast on mobile data.
- Cloudflare now steers new projects towards Workers static assets. Pages is still supported and simpler for a static site. Moving later is cheap because our output is plain files (revisit at M5, when we add APIs).
- GitHub Pages is ruled out because it can't set security headers.

## Consequences
- The owner creates a Cloudflare account (2FA on), adds the domain, and stores a deploy token as a GitHub Actions secret. Claude never holds the token.
- Deploys happen only from `main` after CI passes; pull requests get preview URLs.
- **Zero-rating** (updated 2026-11-21 after research): Vodacom zero-rates approved **URLs/hostnames** through its ConnectU programme (application-based), with the network's policy system matching mainly on hostname (DNS/TLS SNI), sometimes alongside IP ranges. Because matching is by hostname, Cloudflare's shared, changing IPs are acceptable. Confirm the exact method in the ConnectU application. Design rules that follow:
  1. **One hostname for everything** (e.g. `learn.<domain>`): pages, images, scripts, templates, translations, and later the API. Each extra hostname (a `cdn.` or `api.` subdomain) would need its own approval, and anything not approved is charged.
  2. **Nothing from other domains**, including embedded YouTube, Google Docs, fonts and analytics. Zero-rated institutions such as UKZN and Stellenbosch warn that links and embeds pointing outside the approved site are charged.
  3. **No video-heavy features** on the zero-rated hostname. Operators have barred video-intensive content and apply fair-use caps (e.g. 500 MB per day at UKZN, 1 GB per month on Vodacom Siyakha). Any future video is optional, tiny, or on a separate, non-zero-rated hostname.
  4. **Downloads may be treated differently from browsing** depending on the programme. Keep lessons and templates as normal web pages and SVG/HTML that print from the browser, rather than relying on separate PDF downloads. The "Download for offline" feature caches those same pages through the service worker.
  5. Some programmes need a small data balance to connect at all. Offline caching (M1) helps learners who have run out of data.
- **Owner action:** apply via Vodacom ConnectU once the site is live on its final hostname. Later, apply to MTN, Telkom and Cell C as well.
