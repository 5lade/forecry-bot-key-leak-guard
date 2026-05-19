import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { resetOnboardingStore } from '../onboarding/localStore.js';
test('stripe fixture webhook updates account plan and repo gates allow upgraded workspaces', async () => {
    resetOnboardingStore();
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true', APP_BASE_URL: 'http://localhost:3000' }));
    await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 101, message: { text: '/start', chat: { id: 8101 }, from: { id: 8101 } } }) });
    const webhook = await app.inject({
        method: 'POST',
        url: '/billing/stripe/webhook',
        headers: { 'content-type': 'application/json', 'x-key-leak-fixture': 'true' },
        payload: JSON.stringify({ type: 'checkout.session.completed', data: { object: { client_reference_id: 'wksp_tg_8101', metadata: { plan: 'pro' } } } })
    });
    assert.equal(webhook.statusCode, 200);
    assert.equal(webhook.json().plan, 'pro');
    assert.equal(webhook.json().repositoryLimit, 10);
    const callback = await app.inject({ method: 'GET', url: '/oauth/github/callback?workspace_id=wksp_tg_8101&installation_id=8101&repositories=demo/app,demo/api,demo/site' });
    assert.equal(callback.statusCode, 200);
    assert.equal(callback.json().connectedRepositories, 3);
    assert.equal(callback.json().planGate, undefined);
    await app.close();
});
test('trial repo limit blocks excess repos with helpful Telegram-facing copy', async () => {
    resetOnboardingStore();
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true' }));
    await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 102, message: { text: '/start', chat: { id: 8102 }, from: { id: 8102 } } }) });
    const callback = await app.inject({ method: 'GET', url: '/oauth/github/callback?workspace_id=wksp_tg_8102&installation_id=8102&repositories=demo/one,demo/two' });
    assert.equal(callback.statusCode, 200);
    assert.equal(callback.json().connectedRepositories, 1);
    assert.equal(callback.json().planGate.blocked, 1);
    assert.match(callback.json().message, /Trial allows 1 repo/);
    assert.match(callback.json().message, /Upgrade to Pro or Agency/);
    const status = await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 103, message: { text: '/status', chat: { id: 8102 }, from: { id: 8102 } } }) });
    assert.equal(status.statusCode, 200);
    assert.match(status.json().text, /repo limit is 1/);
    await app.close();
});
test('trial-only local mode still creates fixture checkout and portal skeletons', async () => {
    resetOnboardingStore();
    const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true', APP_BASE_URL: 'http://localhost:3000' }));
    await app.inject({ method: 'POST', url: '/webhooks/telegram', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ update_id: 104, message: { text: '/start', chat: { id: 8104 }, from: { id: 8104 } } }) });
    const checkout = await app.inject({ method: 'POST', url: '/billing/checkout', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ workspace_id: 'wksp_tg_8104', plan: 'starter' }) });
    assert.equal(checkout.statusCode, 200);
    assert.equal(checkout.json().mode, 'fixture');
    assert.match(checkout.json().url, /\/billing\/checkout\/fixture/);
    const portal = await app.inject({ method: 'GET', url: '/billing/portal?workspace_id=wksp_tg_8104' });
    assert.equal(portal.statusCode, 200);
    assert.match(portal.json().url, /\/billing\/portal\/fixture/);
    await app.close();
});
