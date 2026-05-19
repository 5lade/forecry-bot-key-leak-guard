import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';
import { incrementCounter, renderPrometheusMetrics, resetMetricsForTests } from './metrics.js';
import { clearDeadLettersForTests, deadLetterSnapshot, withProviderRetry } from './retry.js';
import { redactSecrets, redactString } from './redaction.js';
import { withJobLock } from './jobQueue.js';

test('withProviderRetry retries transient failures with exponential backoff and records metrics', async () => {
  resetMetricsForTests();
  clearDeadLettersForTests();
  const sleeps: number[] = [];
  let attempts = 0;
  const result = await withProviderRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error('rate limited'), { status: 429 });
    return 'ok';
  }, { provider: 'telegram', operation: 'sendMessage', baseDelayMs: 10, sleep: async (ms) => { sleeps.push(ms); } });

  assert.equal(result, 'ok');
  assert.deepEqual(sleeps, [10, 20]);
  const metrics = renderPrometheusMetrics();
  assert.match(metrics, /provider_call_total\{provider="telegram",operation="sendMessage",status="retry"\} 2/);
  assert.match(metrics, /provider_call_total\{provider="telegram",operation="sendMessage",status="success"\} 1/);
});

test('withProviderRetry dead-letters permanent failures', async () => {
  resetMetricsForTests();
  clearDeadLettersForTests();
  await assert.rejects(() => withProviderRetry(async () => {
    throw Object.assign(new Error('bad request'), { status: 400 });
  }, { provider: 'github', operation: 'createCheckRun', sleep: async () => undefined }), /bad request/);
  assert.equal(deadLetterSnapshot().length, 1);
  assert.match(renderPrometheusMetrics(), /dead_letter_total\{provider="github",operation="createCheckRun"\} 1/);
});

test('redaction removes secret keys and token-looking values', () => {
  const redacted = redactSecrets({ nested: { telegramBotToken: '123:abc', note: 'token ghp_abcdefghijklmnopqrstuvwxyz123456' } });
  assert.equal(redacted.nested.telegramBotToken, '[redacted]');
  assert.equal(redacted.nested.note, 'token [redacted]');
  assert.equal(redactString('sk-abcdefghijklmnopqrstuvwxyz1234567890'), '[redacted]');
});

test('job lock rejects concurrent runs and releases after completion', async () => {
  resetMetricsForTests();
  let release!: () => void;
  const first = withJobLock('digest', () => new Promise<void>((resolve) => { release = resolve; }));
  await assert.rejects(() => withJobLock('digest', async () => undefined), /job_locked:digest/);
  release();
  await first;
  await withJobLock('digest', async () => undefined);
});

test('/metrics exposes counters over http', async () => {
  resetMetricsForTests();
  incrementCounter('fixture_events_total', { source: 'test' });
  const app = await buildApp(loadConfig({ NODE_ENV: 'test', LOCAL_FIXTURE_MODE: 'true' }));
  const res = await app.inject({ method: 'GET', url: '/metrics' });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /fixture_events_total\{source="test"\} 1/);
  await app.close();
});
