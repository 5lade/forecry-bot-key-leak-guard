#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null
node dist/jobs/dailyDigest.js "${1:-test/fixtures/daily-digest.json}"
