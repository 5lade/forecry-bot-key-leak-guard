export function createLifecycleState() {
    return { incidentsById: new Map(), incidentKeyToId: new Map(), suppressionsByKey: new Map() };
}
export function incidentDedupeKey(incident) {
    return `${incident.repo}::${incident.fingerprint}`;
}
export function upsertIncident(state, incident, now = new Date()) {
    const at = now.toISOString();
    const key = incidentDedupeKey(incident);
    const suppression = state.suppressionsByKey.get(key);
    if (suppression) {
        const suppressedRecord = {
            incident,
            status: 'false_positive',
            updatedAt: at,
            createdAt: at,
            lastSeenAt: at,
            occurrenceCount: 1,
            history: [{ action: 'suppressed', at, note: `Matched suppression ${suppression.id}` }],
            suppression,
            reminders: [],
            suppressed: true
        };
        return suppressedRecord;
    }
    const existingId = state.incidentKeyToId.get(key);
    const existing = existingId ? state.incidentsById.get(existingId) : undefined;
    if (existing) {
        existing.incident = { ...existing.incident, ...incident, id: existing.incident.id };
        existing.updatedAt = at;
        existing.lastSeenAt = at;
        existing.occurrenceCount += 1;
        if (existing.status === 'resolved') {
            existing.status = 'open';
            existing.history.push({ action: 'reopened', at, note: 'Recurring fingerprint detected after resolution' });
            existing.reminders = scheduleCriticalReminders(existing.incident, at);
        }
        else {
            existing.history.push({ action: 'deduped', at });
        }
        return existing;
    }
    const record = {
        incident,
        status: 'open',
        updatedAt: at,
        createdAt: at,
        lastSeenAt: at,
        occurrenceCount: 1,
        history: [{ action: 'created', at }],
        reminders: scheduleCriticalReminders(incident, at)
    };
    state.incidentsById.set(incident.id, record);
    state.incidentKeyToId.set(key, incident.id);
    return record;
}
export function transitionIncident(state, incidentId, status, action = status, now = new Date()) {
    const record = state.incidentsById.get(incidentId);
    if (!record)
        return undefined;
    const at = now.toISOString();
    record.status = status;
    record.updatedAt = at;
    record.history.push({ action, at });
    if (status === 'false_positive') {
        const suppression = createSuppression(record.incident, at);
        record.suppression = suppression;
        state.suppressionsByKey.set(incidentDedupeKey(record.incident), suppression);
        record.reminders = cancelReminders(record.reminders);
    }
    else if (status === 'resolved') {
        record.reminders = cancelReminders(record.reminders);
    }
    else if (status === 'snoozed') {
        record.reminders = cancelReminders(record.reminders);
    }
    return record;
}
export function scheduleCriticalReminders(incident, createdAtIso) {
    if (incident.severity !== 'critical')
        return [];
    const start = new Date(createdAtIso).getTime();
    return [30, 60, 90, 120, 150, 180, 210, 240].map((minutes) => ({
        id: `rem_${incident.id}_${minutes}`,
        incidentId: incident.id,
        runAt: new Date(start + minutes * 60_000).toISOString(),
        kind: 'critical_incident_reminder',
        status: 'scheduled'
    }));
}
function createSuppression(incident, createdAt) {
    return {
        id: `sup_${Math.abs(hashCode(incidentDedupeKey(incident)))}`,
        repo: incident.repo,
        fingerprint: incident.fingerprint,
        provider: incident.provider,
        incidentId: incident.id,
        createdAt,
        reason: 'false_positive'
    };
}
function cancelReminders(reminders) {
    return reminders.map((job) => ({ ...job, status: 'cancelled' }));
}
function hashCode(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1)
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
    return hash;
}
