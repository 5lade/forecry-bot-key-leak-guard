#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null
FIXTURE_PATH="${1:-test/fixtures/github-push-leak.json}" node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
process.env.LOG_LEVEL = 'silent';
const { buildApp } = await import('./dist/app.js');
const { loadConfig } = await import('./dist/config.js');
const payload = readFileSync(process.env.FIXTURE_PATH, 'utf8');
const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', LOCAL_FIXTURE_MODE: 'true', HMAC_SECRET: process.env.HMAC_SECRET ?? 'fixture-hmac-secret-32-bytes' }));
const response = await app.inject({ method: 'POST', url: '/webhooks/github', headers: { 'content-type': 'application/json', 'x-github-event': 'push', 'x-key-leak-fixture': 'true' }, payload });
await app.close();
if (response.statusCode !== 200) {
  console.error(response.body);
  process.exit(1);
}
const body = response.json();
const alert = body.incidents?.[0];
if (!alert) {
  console.error(JSON.stringify(body));
  process.exit(1);
}
console.log(JSON.stringify(alert, null, 2));
JS
