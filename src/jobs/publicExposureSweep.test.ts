import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintSecret } from '../scanner/scanner.js';
import { resetRateLimits } from '../security/rateLimit.js';
import { resetLocalTelegramStore } from '../integrations/telegram/store.js';
import { runPublicExposureSweep } from './publicExposureSweep.js';

const HMAC_SECRET = 'public-exposure-fixture-hmac-secret';
const OPENAI_SECRET = 'sk-proj-PublicExposureFixtureSecret1234567890ABCDE';

test('public exposure sweep runs in fixture mode and creates high-confidence incidents only', async () => {
  resetRateLimits();
  resetLocalTelegramStore();
  const fingerprint = fingerprintSecret(OPENAI_SECRET, 'openai', HMAC_SECRET);

  const result = await runPublicExposureSweep({
    fixtureMode: true,
    hmacSecret: HMAC_SECRET,
    knownSignals: [{ provider: 'openai', fingerprint }],
    now: new Date('2026-05-19T07:00:00Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.state, 'completed');
  assert.equal(result.attemptedQueries, 1);
  assert.equal(result.searchedItems, 2);
  assert.equal(result.incidentsCreated, 1);
  assert.equal(result.incidents[0]?.fingerprint, fingerprint);
  assert.equal(result.incidents[0]?.provider, 'openai');
  assert.match(result.incidents[0]?.ruleId ?? '', /^public-code-search:/);
  assert.doesNotMatch(JSON.stringify(result), /PublicExposureFixtureSecret1234567890ABCDE/);
});

test('public exposure sweep reports unavailable state without crashing', async () => {
  resetRateLimits();
  const result = await runPublicExposureSweep({
    enabled: false,
    knownSignals: [{ provider: 'openai' }]
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, 'unavailable');
  assert.equal(result.incidentsCreated, 0);
  assert.match(result.message, /disabled|token|fixture/i);
});

test('public exposure sweep respects configured rate limit', async () => {
  resetRateLimits();
  const result = await runPublicExposureSweep({
    fixtureMode: true,
    rateLimitPerMinute: 1,
    knownSignals: [{ provider: 'openai' }, { provider: 'stripe' }],
    hmacSecret: HMAC_SECRET,
    now: new Date('2026-05-19T07:00:00Z')
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, 'rate_limited');
  assert.equal(result.attemptedQueries, 1);
  assert.equal(result.incidentsCreated, 0);
  assert.ok((result.rateLimitRetryAfterMs ?? 0) > 0);
});
