import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAlertPolicy, isRepoScanEnabled, resetAlertPolicies, shouldAlertForSeverity, shouldSendDigestAt, spendAnomalyThresholdFor, updateAlertPolicy } from './alertPolicy.js';
test('alert policy persists per workspace and validates helpful values', () => {
    resetAlertPolicies();
    const workspaceId = 'wksp_settings_1';
    updateAlertPolicy(workspaceId, {
        severityThreshold: 'critical',
        digestTimeUtc: '7:05',
        reminderCadenceMinutes: '45m',
        repo: { fullName: 'Demo/App', enabled: false },
        spendAnomaly: { provider: 'OpenAI', multiplier: '4.5x' }
    });
    const policy = getAlertPolicy(workspaceId);
    assert.equal(policy.severityThreshold, 'critical');
    assert.equal(policy.digestTimeUtc, '07:05');
    assert.equal(policy.reminderCadenceMinutes, 45);
    assert.equal(isRepoScanEnabled(workspaceId, 'demo/app'), false);
    assert.equal(isRepoScanEnabled(workspaceId, 'demo/other'), true);
    assert.equal(spendAnomalyThresholdFor(workspaceId, 'openai'), 4.5);
    assert.equal(shouldSendDigestAt(workspaceId, '07:05'), true);
    assert.equal(shouldAlertForSeverity(workspaceId, 'high'), false);
    assert.equal(shouldAlertForSeverity(workspaceId, 'critical'), true);
    assert.throws(() => updateAlertPolicy(workspaceId, { severityThreshold: 'urgent' }), /low, medium, high, or critical/);
    assert.throws(() => updateAlertPolicy(workspaceId, { digestTimeUtc: '25:00' }), /HH:MM/);
});
