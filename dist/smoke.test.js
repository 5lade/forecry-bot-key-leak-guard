import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from './config.js';
import { buildApp } from './app.js';
test('/health and /ready are available in local mode', async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true' }));
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ok, true);
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().ok, true);
    await app.close();
});
test('production readiness reports missing required credentials', async () => {
    const app = await buildApp(loadConfig({ NODE_ENV: 'production' }));
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    assert.equal(ready.statusCode, 503);
    assert.equal(ready.json().ok, false);
    assert.ok(ready.json().missingForProduction.includes('DATABASE_URL'));
    await app.close();
});
