#!/usr/bin/env bash
# bin/test-completion.sh - acceptance test runner for Key Leak Guard
set -uo pipefail
BOT_SLUG="key-leak-guard"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
if [ -n "${FIXTURE_DIR:-}" ]; then
  FIXTURE_DIR="$FIXTURE_DIR"
elif [ -d /bot/test/fixtures ]; then
  FIXTURE_DIR=/bot/test/fixtures
else
  FIXTURE_DIR="$(cd "$(dirname "$0")/.." && pwd)/test/fixtures"
fi
LOG_DIR="${LOG_DIR:-/var/log/forecry-bot-${BOT_SLUG}}"
PASS=0
FAIL=0
APP_PID=""
cleanup(){ if [ -n "${APP_PID}" ] && kill -0 "${APP_PID}" 2>/dev/null; then kill "${APP_PID}" 2>/dev/null || true; wait "${APP_PID}" 2>/dev/null || true; fi; }
trap cleanup EXIT
check() { local name="$1"; shift; echo "[$name] $*"; }
pass(){ echo "  PASS"; PASS=$((PASS+1)); }
fail(){ echo "  FAIL"; FAIL=$((FAIL+1)); }

ensure_health(){
  if curl -fsS --max-time 3 "${APP_URL}/health" >/tmp/key-leak-health.json 2>/dev/null; then
    return 0
  fi
  echo "  Health endpoint unavailable at ${APP_URL}/health; starting local fixture service"
  npm run build >/dev/null || return 1
  local port host
  port=$(node -e "const u=new URL(process.env.APP_URL); console.log(u.port || (u.protocol==='https:'?'443':'80'))" 2>/dev/null || echo 3000)
  host=$(node -e "const u=new URL(process.env.APP_URL); console.log(u.hostname)" 2>/dev/null || echo 127.0.0.1)
  NODE_ENV=test LOG_LEVEL=silent LOCAL_FIXTURE_MODE=true HMAC_SECRET="${HMAC_SECRET:-fixture-hmac-secret-32-bytes}" CREDENTIAL_ENCRYPTION_SECRET="${CREDENTIAL_ENCRYPTION_SECRET:-fixture-credential-secret-32-bytes}" HOST="$host" PORT="$port" node dist/index.js >/tmp/key-leak-health-server.log 2>&1 &
  APP_PID=$!
  for _ in $(seq 1 20); do
    curl -fsS --max-time 2 "${APP_URL}/health" >/tmp/key-leak-health.json 2>/dev/null && return 0
    sleep 0.5
  done
  cat /tmp/key-leak-health-server.log 2>/dev/null || true
  return 1
}

echo "Running acceptance tests for ${BOT_SLUG}..."

check criterion-1 "Leak detection accuracy fixture >=95% TP and <=5% FP"
if [ -x ./bin/run-fixture-scan.sh ] && [ -d "${FIXTURE_DIR}/secrets" ]; then
  out=$(./bin/run-fixture-scan.sh "${FIXTURE_DIR}/secrets" 2>/dev/null || true)
  tp=$(printf '%s' "$out" | sed -n 's/.*true_positive_rate=\([0-9.]*\).*/\1/p' | tail -1)
  fp=$(printf '%s' "$out" | sed -n 's/.*false_positive_rate=\([0-9.]*\).*/\1/p' | tail -1)
  awk "BEGIN{exit !(($tp >= 0.95) && ($fp <= 0.05))}" && pass || fail
else
  echo "  Missing executable scanner runner or fixture directory: ${FIXTURE_DIR}/secrets"; fail
fi

check criterion-2 "GitHub push webhook to Telegram-ready incident payload <=30s"
if [ -x ./bin/simulate-webhook.sh ]; then
  start=$(date +%s); ./bin/simulate-webhook.sh "${FIXTURE_DIR}/github-push-leak.json" >/tmp/key-leak-alert.json 2>/dev/null; rc=$?; elapsed=$(( $(date +%s) - start ))
  if [ $rc -eq 0 ] && [ $elapsed -le 30 ] && grep -Eq 'provider|rotation|confidence|severity' /tmp/key-leak-alert.json; then pass; else fail; fi
else
  echo "  SKIP: ./bin/simulate-webhook.sh not implemented yet; Stage 4 must wire this to webhook handler"; fail
fi

check criterion-3 "Spend spike correlation escalates severity to critical"
if [ -x ./bin/run-spend-correlation-fixture.sh ]; then
  out=$(./bin/run-spend-correlation-fixture.sh "${FIXTURE_DIR}/billing-spike.json" 2>/dev/null || true)
  printf '%s' "$out" | grep -q 'severity=critical' && printf '%s' "$out" | grep -q 'linked_incident=true' && pass || fail
else
  echo "  SKIP: ./bin/run-spend-correlation-fixture.sh not implemented yet"; fail
fi

check criterion-4 "Daily digest required fields present"
if [ -x ./bin/render-digest-fixture.sh ]; then
  out=$(./bin/render-digest-fixture.sh 2>/dev/null || true)
  printf '%s' "$out" | grep -q 'repos_scanned' && printf '%s' "$out" | grep -q 'unresolved_rotation_tasks' && printf '%s' "$out" | grep -q 'provider_spend_deltas' && pass || fail
else
  echo "  SKIP: ./bin/render-digest-fixture.sh not implemented yet"; fail
fi

check criterion-5 "Operational health endpoint/log sanity"
if ensure_health; then
  grep -qi 'ok\|healthy' /tmp/key-leak-health.json && pass || fail
else
  echo "  Health endpoint unavailable at ${APP_URL}/health"; fail
fi
if [ -d "$LOG_DIR" ] && grep -Riq 'unhandled\|fatal\|panic' "$LOG_DIR" 2>/dev/null; then
  echo "  Fatal log pattern found"; FAIL=$((FAIL+1))
fi

echo ""
echo "Result: ${PASS} pass, ${FAIL} fail"
[ $FAIL -eq 0 ]
