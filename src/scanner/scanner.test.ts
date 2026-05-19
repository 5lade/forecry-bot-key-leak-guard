import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixtureCases } from './fixtureData.js';
import { scanText } from './scanner.js';

const hmacSecret = 'unit-test-hmac-secret-32-bytes';

test('fixture corpus meets scanner accuracy thresholds', () => {
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;
  for (const fixture of fixtureCases) {
    const result = scanText({ content: fixture.content, filePath: `${fixture.id}.txt`, hmacSecret });
    const found = result.findings.length > 0;
    if (fixture.expectedFindings > 0 && found) tp += 1;
    if (fixture.expectedFindings > 0 && !found) fn += 1;
    if (fixture.expectedFindings === 0 && found) fp += 1;
    if (fixture.expectedFindings === 0 && !found) tn += 1;
  }
  assert.equal(fixtureCases.filter((fixture) => fixture.expectedFindings > 0).length, 20);
  assert.equal(fixtureCases.filter((fixture) => fixture.expectedFindings === 0).length, 80);
  assert.ok(tp / (tp + fn) >= 0.95, `true positive rate too low: ${tp}/${tp + fn}`);
  assert.ok(fp / (fp + tn) <= 0.05, `false positive rate too high: ${fp}/${fp + tn}`);
});

test('findings never expose raw fixture secrets', () => {
  for (const fixture of fixtureCases.filter((item) => item.rawSecret)) {
    const result = scanText({ content: fixture.content, filePath: `${fixture.id}.txt`, hmacSecret });
    const serialized = JSON.stringify(result.findings);
    assert.ok(result.findings.length > 0, `${fixture.id} should produce a finding`);
    assert.ok(fixture.rawSecret);
    assert.doesNotMatch(serialized, new RegExp(escapeRegExp(fixture.rawSecret)));
    assert.match(serialized, /hmac_sha256:/);
    assert.match(serialized, /…/);
  }
});

test('scanner fingerprints are deterministic and hmac scoped', () => {
  const sample = fixtureCases.find((fixture) => fixture.rawSecret)!;
  const first = scanText({ content: sample.content, hmacSecret }).findings[0];
  const second = scanText({ content: sample.content, hmacSecret }).findings[0];
  const otherSecret = scanText({ content: sample.content, hmacSecret: 'different-hmac-secret-32-bytes' }).findings[0];
  assert.equal(first.fingerprint, second.fingerprint);
  assert.notEqual(first.fingerprint, otherSecret.fingerprint);
  assert.equal(first.fingerprint.startsWith(`hmac_sha256:${first.provider}:`), true);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
