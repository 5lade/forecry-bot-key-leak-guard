#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null
HMAC_SECRET="${HMAC_SECRET:-fixture-hmac-secret-32-bytes}" node dist/scanner/runFixtureScan.js
