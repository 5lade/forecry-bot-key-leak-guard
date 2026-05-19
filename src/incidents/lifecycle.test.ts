import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dueCriticalIncidentReminders } from '../jobs/reminders.js';
import { sampleIncidentForTelegram } from '../integrations/telegram/commands.js';
import { getLocalIncident, resetLocalTelegramStore, updateLocalIncidentStatus, upsertLocalIncident } from '../integrations/telegram/store.js';

test('duplicate fingerprint and repo incidents dedupe into one lifecycle record', () => {
  resetLocalTelegramStore();
  const first = sampleIncidentForTelegram();
  const duplicate = { ...first, id: 'inc_duplicate_id', commitSha: 'def456' };

  const created = upsertLocalIncident(first, new Date('2026-05-19T00:00:00Z'));
  const deduped = upsertLocalIncident(duplicate, new Date('2026-05-19T00:05:00Z'));

  assert.equal(deduped.incident.id, created.incident.id);
  assert.equal(deduped.occurrenceCount, 2);
  assert.equal(deduped.history.at(-1)?.action, 'deduped');
});

test('false positives create suppressions that suppress future matching findings', () => {
  resetLocalTelegramStore();
  const incident = sampleIncidentForTelegram();
  upsertLocalIncident(incident, new Date('2026-05-19T01:00:00Z'));
  const falsePositive = updateLocalIncidentStatus(incident.id, 'false_positive', 'false_positive', new Date('2026-05-19T01:01:00Z'));
  assert.equal(falsePositive?.suppression?.reason, 'false_positive');

  const future = upsertLocalIncident({ ...incident, id: 'inc_future_match', commitSha: 'future123' }, new Date('2026-05-19T02:00:00Z'));
  assert.equal(future.suppressed, true);
  assert.equal(future.status, 'false_positive');
  assert.equal(getLocalIncident('inc_future_match'), undefined);
});

test('resolved incidents reopen on later recurrence', () => {
  resetLocalTelegramStore();
  const incident = sampleIncidentForTelegram();
  upsertLocalIncident(incident, new Date('2026-05-19T03:00:00Z'));
  updateLocalIncidentStatus(incident.id, 'resolved', 'resolve', new Date('2026-05-19T03:10:00Z'));

  const reopened = upsertLocalIncident({ ...incident, id: 'inc_recurs', commitSha: 'recurs123' }, new Date('2026-05-19T04:00:00Z'));
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.history.at(-1)?.action, 'reopened');
});

test('critical unresolved reminders are scheduled every 30 minutes for the first 4 hours', () => {
  resetLocalTelegramStore();
  const incident = sampleIncidentForTelegram();
  const record = upsertLocalIncident(incident, new Date('2026-05-19T05:00:00Z'));

  assert.deepEqual(record.reminders.map((job) => job.runAt), [
    '2026-05-19T05:30:00.000Z',
    '2026-05-19T06:00:00.000Z',
    '2026-05-19T06:30:00.000Z',
    '2026-05-19T07:00:00.000Z',
    '2026-05-19T07:30:00.000Z',
    '2026-05-19T08:00:00.000Z',
    '2026-05-19T08:30:00.000Z',
    '2026-05-19T09:00:00.000Z'
  ]);

  const due = dueCriticalIncidentReminders([record], new Date('2026-05-19T06:01:00Z'));
  assert.equal(due.due.length, 2);
  assert.equal(due.pending.length, 6);
});
