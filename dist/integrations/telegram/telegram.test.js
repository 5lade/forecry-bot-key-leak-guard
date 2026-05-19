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
