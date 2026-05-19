import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { correlateSpendWithFindings, type RecentFinding, type SpendSnapshot } from './correlation.js';

interface FixtureFile {
  snapshots: SpendSnapshot[];
  recentFindings: RecentFinding[];
}

const fixturePath = resolve(process.cwd(), process.argv[2] ?? 'test/fixtures/billing-spike.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureFile;
const result = correlateSpendWithFindings({ snapshots: fixture.snapshots, recentFindings: fixture.recentFindings });

const linked = result.anomalies.find((anomaly) => anomaly.provider === 'openai');
const uncorrelated = result.anomalies.find((anomaly) => anomaly.provider === 'anthropic');

console.log(`anomalies=${result.anomalies.length}`);
if (linked) {
  console.log(`provider=${linked.provider} severity=${linked.severity} linked_incident=${linked.linkedIncident} multiplier=${linked.multiplier} linked_finding_id=${linked.linkedFindingId ?? 'none'}`);
}
if (uncorrelated) {
  console.log(`provider=${uncorrelated.provider} severity=${uncorrelated.severity} linked_incident=${uncorrelated.linkedIncident} multiplier=${uncorrelated.multiplier}`);
  console.log(`non_correlated_linked_incident=${uncorrelated.linkedIncident}`);
}

if (!linked || linked.severity !== 'critical' || linked.linkedIncident !== true) {
  console.error('Expected correlated OpenAI spend spike to become severity=critical and linked_incident=true');
  process.exitCode = 1;
}
if (!uncorrelated || uncorrelated.linkedIncident !== false) {
  console.error('Expected non-correlated Anthropic spend spike to remain an anomaly without an incident link');
  process.exitCode = 1;
}
