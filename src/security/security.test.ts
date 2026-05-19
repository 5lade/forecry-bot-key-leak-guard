import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createAdminToken } from '../http/admin.js';
import { recordGitHubInstallation, resetOnboardingStore } from '../onboarding/localStore.js';
import { ensureTelegramWorkspace } from '../onboarding/localStore.js';
import { resetLocalTelegramStore, upsertLocalIncident } from '../integrations/telegram/store.js';
import { sampleIncidentForTelegram } from '../integrations/telegram/commands.js';
import { decryptCredentials, encryptCredentials, encryptedCredentialPreview, listAuditEvents, resetAuditEvents, resetRateLimits, safeEqualSecret } from './index.js';

const secret = 'test-credential-encryption-secret-32-bytes';
const rawToken = 'sk-proj-SecurityHardeningSecret1234567890ABCDE';

test('credential helpers encrypt stored provider credentials without plaintext leakage', () => {
  const encrypted = encryptCredentials({ provider: 'openai', apiKey: rawToken }, secret);
  assert.doesNotMatch(encrypted.toString('utf8'), new RegExp(rawToken));
  assert.deepEqual(decryptCredentials(encrypted, secret), { provider: 'openai', apiKey: rawToken });
  assert.doesNotMatch(encryptedCredentialPreview(encrypted), new RegExp(rawToken));
  assert.match(encryptedCredentialPreview(encrypted), /\[encrypted\]/);
});

test('webhook secret comparisons are timing-safe and reject mismatches', () => {
  assert.equal(safeEqualSecret('expected-secret', 'expected-secret'), true);
  assert.equal(safeEqualSecret('wrong-secret', 'expected-secret'), false);
  assert.equal(safeEqualSecret(undefined, 'expected-secret'), false);
});

test('telegram webhook rejects invalid secret, caps large payloads, rate limits, and audits rejections', async () => {
  resetAuditEvents();
  resetRateLimits();
  const app = await buildApp(loadConfig({ NODE_ENV: 'test', TELEGRAM_WEBHOOK_SECRET: 'telegram-hardening-secret', MAX_REQUEST_BYTES: '256', WEBHOOK_RATE_LIMIT_PER_MINUTE: '2' }));

  const invalid = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'bad' }, payload: JSON.stringify({ update_id: 1 }) });
  assert.equal(invalid.statusCode, 401);
  assert.equal(listAuditEvents().some((event) => event.action === 'webhook_secret_rejected'), true);

  const large = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'telegram-hardening-secret' }, payload: JSON.stringify({ update_id: 2, message: { text: 'x'.repeat(500), chat: { id: 1 } } }) });
  assert.equal(large.statusCode, 413);

  const first = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'telegram-hardening-secret' }, payload: JSON.stringify({ update_id: 3 }) });
  assert.equal(first.statusCode, 200);
  const limited = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'telegram-hardening-secret' }, payload: JSON.stringify({ update_id: 4 }) });
  assert.equal(limited.statusCode, 429);
  await app.close();
});

test('workspace purge deletes local repo and installation data and records audit trail', async () => {
  resetOnboardingStore();
  resetLocalTelegramStore();
  resetAuditEvents();
  const config = loadConfig({ NODE_ENV: 'test', HMAC_SECRET: 'admin-hardening-hmac-secret' });
  const snapshot = ensureTelegramWorkspace({ chatId: 777, userId: 888, username: 'security_fixture' });
  recordGitHubInstallation({ workspaceId: snapshot.workspace.id, installationId: 123, accountLogin: 'fixture', repositories: [{ fullName: 'demo/secure', id: 987 }] });
  upsertLocalIncident(sampleIncidentForTelegram());
  const token = createAdminToken(config, snapshot.workspace.id);
  const app = await buildApp(config);

  const purge = await app.inject({ method: 'DELETE', url: `/admin/workspaces/${snapshot.workspace.id}?token=${token}` });
  assert.equal(purge.statusCode, 200);
  assert.equal(purge.json().workspaceDeleted, true);
  assert.equal(purge.json().repositoriesDeleted, 1);
  assert.equal(purge.json().installationsDeleted, 1);
  assert.equal(listAuditEvents(snapshot.workspace.id).some((event) => event.action === 'workspace_purged'), true);

  const admin = await app.inject({ method: 'GET', url: `/admin?workspace_id=${snapshot.workspace.id}&token=${token}` });
  assert.equal(admin.statusCode, 404);
  await app.close();
});
