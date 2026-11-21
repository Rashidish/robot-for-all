# ADR-0002: Hosting

- **Status:** Proposed
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
- **Zero-rating risk:** mobile networks often zero-rate by IP address or hostname. Cloudflare's IP addresses are shared and change, which can make IP-based zero-rating impossible. **Ask Vodacom how they whitelist before relying on this.** If they need fixed IPs, we add a small South African host (or the network's own education platform) just for the zero-rated hostname, without changing the build.
