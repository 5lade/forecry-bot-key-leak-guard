import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { createAdminToken } from './admin.js';
import { ensureTelegramWorkspace, recordGitHubInstallation, resetOnboardingStore } from '../onboarding/localStore.js';
import { resetLocalTelegramStore, upsertLocalIncident } from '../integrations/telegram/store.js';
import { sampleIncidentForTelegram } from '../integrations/telegram/commands.js';

test('admin page requires a signed token and renders safe onboarding status', async () => {
  resetOnboardingStore();
  resetLocalTelegramStore();
  const config = loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true', HMAC_SECRET: 'test-admin-secret' });
  const snapshot = ensureTelegramWorkspace({ chatId: 123, userId: 456, username: 'founder' });
  recordGitHubInstallation({ workspaceId: snapshot.workspace.id, installationId: 42, repositories: [{ fullName: 'demo/key-leak-guard-fixture', defaultBranch: 'main', private: true }] });
  upsertLocalIncident({ ...sampleIncidentForTelegram(), workspaceId: snapshot.workspace.id } as any);

  const app = await buildApp(config);
  const denied = await app.inject({ method: 'GET', url: `/admin?workspace_id=${snapshot.workspace.id}` });
  assert.equal(denied.statusCode, 401);

  const token = createAdminToken(config, snapshot.workspace.id);
  const ok = await app.inject({ method: 'GET', url: `/admin?workspace_id=${snapshot.workspace.id}&token=${token}` });
  assert.equal(ok.statusCode, 200);
  assert.match(ok.body, /demo\/key-leak-guard-fixture/);
  assert.match(ok.body, /Provider spend sources/);
  assert.match(ok.body, /GitHub setup\/status/);
  assert.doesNotMatch(ok.body, /sk-proj/);
  await app.close();
});
