#!/usr/bin/env bash
# Deploy the CRM to the owner's Vercel project using the Build Output API.
# Requires VERCEL_TOKEN in the environment (owner's Vercel account token).
# Links to the existing project if one is already linked in .vercel/, else
# links/creates by the repo's directory name.
set -euo pipefail
cd "$(dirname "$0")"
: "${VERCEL_TOKEN:?VERCEL_TOKEN must be set}"
bun install
bunx vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
bash ./build-vercel.sh
bunx vercel deploy --prebuilt --prod --token="$VERCEL_TOKEN"
