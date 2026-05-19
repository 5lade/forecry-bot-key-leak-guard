import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rotationChecklistFor, rotationRunbookFor, SUPPORTED_ROTATION_PROVIDERS } from './rotation.js';
import { renderRotationChecklist } from '../renderers/rotation.js';
const requiredProviders = ['openai', 'anthropic', 'gemini', 'replicate', 'huggingface', 'stability', 'stripe', 'github', 'slack'];
const requiredPhrases = [/revoke|delete|roll/i, /usage|audit|logs/i, /secret|CI|deploy/i, /redeploy|restart/i, /no new|old credential|revoked/i];
test('supported providers have complete rotation runbooks', () => {
    for (const provider of requiredProviders) {
        assert.ok(SUPPORTED_ROTATION_PROVIDERS.includes(provider), `${provider} should be supported`);
        const runbook = rotationRunbookFor(provider);
        assert.equal(runbook.provider, provider);
        assert.match(runbook.consoleUrl, /^https:\/\//);
        assert.match(runbook.docsUrl, /^https:\/\//);
        assert.ok(runbook.blastRadius.length >= 3, `${provider} blast-radius checklist too short`);
        assert.ok(runbook.postRotationVerification.length >= 3, `${provider} verification checklist too short`);
        const checklist = rotationChecklistFor(provider);
        assert.ok(checklist.length >= 18, `${provider} checklist too short`);
        for (const phrase of requiredPhrases)
            assert.match(checklist.join('\n'), phrase, `${provider} missing ${phrase}`);
    }
});
test('telegram rotation renderer is concise and markdown-safe', () => {
    const text = renderRotationChecklist({ provider: 'openai', rotationChecklist: rotationChecklistFor('openai') });
    assert.match(text, /OpenAI rotation/);
    assert.match(text, /Console: https:\/\/platform\.openai\.com\/api-keys/);
    assert.match(text, /Blast radius/);
    assert.doesNotMatch(text, /sk-proj-[A-Za-z0-9_-]{16,}/);
    assert.ok(text.length < 1700, `renderer should stay concise, got ${text.length}`);
});
