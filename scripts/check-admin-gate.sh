#!/usr/bin/env bash
# The built back office (ADR-0009, ADR-0011) runs in the local Worker runtime and must refuse
# every page without a valid Cloudflare Access token, with the security headers set.
# Run after `npm run build:admin`.
set -euo pipefail
cd "$(dirname "$0")/../apps/admin"
printf 'SUPABASE_URL=https://example.invalid\nSUPABASE_ANON_KEY=test\n' > dist/server/.dev.vars
trap 'npx astro preview stop >/dev/null 2>&1 || true; rm -f dist/server/.dev.vars' EXIT
npx astro preview --port 4330 >/dev/null 2>&1 &
for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:4330/ && break; sleep 1; done
fail=0
check() {
  local path=$1 extra=${2:-}
  local headers
  headers=$(curl -s -D - -o /dev/null ${extra:+-H "$extra"} "http://localhost:4330$path")
  local status
  status=$(echo "$headers" | head -1 | awk '{print $2}')
  if [ "$status" != "403" ]; then echo "::error::$path${extra:+ ($extra)} gave $status, expected 403"; fail=1; fi
  for h in content-security-policy x-robots-tag cache-control; do
    echo "$headers" | grep -qi "^$h:" || { echo "::error::$path is missing $h"; fail=1; }
  done
}
for p in / /sign-in/ /mfa/ /people/ /seasons/ /site/ /lessons/ /lessons/p2-art-01/ /profile/ /withdrawn/ /worlds/ /worlds/bump-maze/ /languages/ /no-role/; do check "$p"; done
check /sign-in/ "Cf-Access-Jwt-Assertion: forged.token.value"
[ $fail = 0 ] && echo "Back office refuses every page without Cloudflare Access."
exit $fail
