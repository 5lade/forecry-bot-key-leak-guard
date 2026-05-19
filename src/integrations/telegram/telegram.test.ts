import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../../app.js';
import { loadConfig } from '../../config.js';
import { renderCriticalLeakAlert } from '../../renderers/alerts.js';
import { sampleIncidentForTelegram } from './commands.js';
import { getLocalIncident, resetLocalTelegramStore, upsertLocalIncident } from './store.js';

const rawSecret = 'sk-proj-KeyLeakWebhookFixtureSecret1234567890ABCDE';

test('critical Telegram alert renders without raw secret and includes actions', () => {
  const incident = { ...sampleIncidentForTelegram(), redactedContext: `OPENAI_API_KEY=${rawSecret}` };
  const alert = renderCriticalLeakAlert(incident);
  const serialized = JSON.stringify(alert);
  assert.doesNotMatch(serialized, new RegExp(rawSecret));
  assert.match(serialized, /Acknowledge/);
  assert.match(serialized, /Resolve/);
  assert.match(serialized, /Rotation checklist/);
});

test('telegram callback handlers update incident state in local persistence', async () => {
  resetLocalTelegramStore();
  const incident = sampleIncidentForTelegram();
  upsertLocalIncident(incident);
  const app = await buildApp(loadConfig({ NODE_ENV: 'test', TELEGRAM_WEBHOOK_SECRET: 'telegram-test-secret' }));
  const response = await app.inject({
    method: 'POST',
    url: '/webhooks/telegram',
    headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'telegram-test-secret' },
    payload: JSON.stringify({ update_id: 1, callback_query: { id: 'cb1', data: `incident:acknowledge:${incident.id}` } })
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'acknowledged');
  assert.equal(getLocalIncident(incident.id)?.status, 'acknowledged');
  await app.close();
});

test('telegram command routing and health are independent of Telegram availability', async () => {
  const app = await buildApp(loadConfig({ NODE_ENV: 'test' }));
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().ok, true);

  const command = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 2, message: { text: '/status', chat: { id: 123 } } }) });
  assert.equal(command.statusCode, 200);
  assert.match(command.json().text, /online/);
  await app.close();
});

test('telegram onboarding creates workspace and fixture GitHub callback syncs repositories', async () => {
  resetLocalTelegramStore();
  const { resetOnboardingStore } = await import('../../onboarding/localStore.js');
  resetOnboardingStore();
  const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true', APP_BASE_URL: 'http://localhost:3000' }));

  const start = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 10, message: { text: '/start', chat: { id: 123 }, from: { id: 456, username: 'fixture_founder' } } }) });
  assert.equal(start.statusCode, 200);
  assert.match(start.json().text, /wksp_tg_123/);
  assert.match(start.json().text, /Setup link/);

  const callback = await app.inject({ method: 'GET', url: '/oauth/github/callback?workspace_id=wksp_tg_123&installation_id=777&repositories=demo/app,demo/api' });
  assert.equal(callback.statusCode, 200);
  assert.equal(callback.json().connectedRepositories, 2);

  const status = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 11, message: { text: '/status', chat: { id: 123 }, from: { id: 456 } } }) });
  assert.equal(status.statusCode, 200);
  assert.match(status.json().text, /Connected repos: 2 repos/);
  assert.match(status.json().text, /Open incidents: 0/);
  await app.close();
});

test('github install route returns actionable missing credential guidance without crashing', async () => {
  const { resetOnboardingStore } = await import('../../onboarding/localStore.js');
  resetOnboardingStore();
  const app = await buildApp(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://example.local/key_leak_guard', TELEGRAM_BOT_TOKEN: 'telegram-token', GITHUB_WEBHOOK_SECRET: 'github-webhook-secret', HMAC_SECRET: 'hmac-secret-for-tests' }));
  await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 12, message: { text: '/start', chat: { id: 321 }, from: { id: 654 } } }) });
  const install = await app.inject({ method: 'GET', url: '/github/install?workspace_id=wksp_tg_321' });
  assert.equal(install.statusCode, 200);
  assert.equal(install.json().ok, false);
  assert.match(install.json().message, /GITHUB_APP_ID/);
  await app.close();
});

test('manual scan command runs fixture scan and unknown repos are clear errors', async () => {
  resetLocalTelegramStore();
  const { resetOnboardingStore } = await import('../../onboarding/localStore.js');
  resetOnboardingStore();
  const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true', HMAC_SECRET: 'hmac-secret-for-manual-scan-tests' }));

  await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 20, message: { text: '/start', chat: { id: 999 }, from: { id: 999 } } }) });
  await app.inject({ method: 'GET', url: '/oauth/github/callback?workspace_id=wksp_tg_999&installation_id=888&repositories=demo/key-leak-guard-fixture' });

  const scan = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 21, message: { text: '/scan demo/key-leak-guard-fixture', chat: { id: 999 }, from: { id: 999 } } }) });
  assert.equal(scan.statusCode, 200);
  assert.match(scan.json().text, /Manual scan completed/);
  assert.match(scan.json().text, /Scanned file count: 3/);
  assert.match(scan.json().text, /critical=1/);
  assert.match(scan.json().text, /Incident links: inc_manual_/);

  const unknown = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 22, message: { text: '/scan missing/repo', chat: { id: 999 }, from: { id: 999 } } }) });
  assert.equal(unknown.statusCode, 200);
  assert.match(unknown.json().text, /Unknown repo "missing\/repo"/);
  await app.close();
});
