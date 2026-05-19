#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null
node dist/spend/runSpendCorrelationFixture.js "${1:-test/fixtures/billing-spike.json}"
