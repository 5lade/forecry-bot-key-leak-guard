#!/usr/bin/env bash
# bin/test-completion.sh - acceptance test runner for Key Leak Guard
set -uo pipefail
BOT_SLUG="key-leak-guard"
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
FIXTURE_DIR="${FIXTURE_DIR:-/bot/test/fixtures}"
LOG_DIR="${LOG_DIR:-/var/log/forecry-bot-${BOT_SLUG}}"
PASS=0
FAIL=0
check() { local name="$1"; shift; echo "[$name] $*"; }
pass(){ echo "  PASS"; PASS=$((PASS+1)); }
fail(){ echo "  FAIL"; FAIL=$((FAIL+1)); }

echo "Running acceptance tests for ${BOT_SLUG}..."

check criterion-1 "Leak detection accuracy fixture >=95% TP and <=5% FP"
if [ -x ./bin/run-fixture-scan.sh ]; then
  out=$(./bin/run-fixture-scan.sh "${FIXTURE_DIR}/secrets" 2>/dev/null || true)
  tp=$(printf '%s' "$out" | sed -n 's/.*true_positive_rate=\([0-9.]*\).*/\1/p' | tail -1)
  fp=$(printf '%s' "$out" | sed -n 's/.*false_positive_rate=\([0-9.]*\).*/\1/p' | tail -1)
  awk "BEGIN{exit !(($tp >= 0.95) && ($fp <= 0.05))}" && pass || fail
else
  echo "  SKIP: ./bin/run-fixture-scan.sh not implemented yet; Stage 4 must wire this to scanner fixtures"; fail
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
if curl -fsS --max-time 5 "${APP_URL}/health" >/tmp/key-leak-health.json 2>/dev/null; then
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
