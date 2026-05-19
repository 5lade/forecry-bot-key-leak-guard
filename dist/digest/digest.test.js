import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateDailyDigest, renderTelegramDigest } from './digest.js';
const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'test/fixtures/daily-digest.json'), 'utf8'));
test('daily digest aggregates required fields across seven sample days', () => {
    const summary = generateDailyDigest(fixture);
    assert.equal(summary.daysCovered, 7);
    assert.equal(summary.repos_scanned, 37);
    assert.equal(summary.incidents_opened, 4);
    assert.equal(summary.incidents_resolved, 5);
    assert.equal(summary.unresolved_rotation_tasks, 11);
    assert.equal(summary.provider_spend_deltas.openai, 3.8);
    assert.match(summary.top_risk, /critical/);
    assert.match(summary.next_recommended_action, /rotation task/);
});
test('telegram digest contains all required fields and redacts secret-like values', () => {
    const input = {
        ...fixture,
        workspaceName: 'Workspace sk-proj-RawSecretShouldNotRender1234567890',
        days: fixture.days.map((day, index) => index === 0 ? { ...day, risks: [{ label: 'Leaked sk-proj-RawSecretShouldNotRender1234567890', severity: 'critical', provider: 'openai', repo: 'demo/api' }] } : day)
    };
    const rendered = renderTelegramDigest(generateDailyDigest(input));
    for (const field of ['repos_scanned', 'incidents_opened', 'incidents_resolved', 'unresolved_rotation_tasks', 'provider_spend_deltas', 'top_risk', 'next_recommended_action']) {
        assert.match(rendered, new RegExp(`${field}:`));
    }
    assert.doesNotMatch(rendered, /RawSecretShouldNotRender/);
    assert.match(rendered, /\[redacted\]/);
});
