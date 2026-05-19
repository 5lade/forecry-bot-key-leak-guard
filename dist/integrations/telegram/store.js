const incidents = new Map();
export function upsertLocalIncident(incident) {
    const existing = incidents.get(incident.id);
    const record = existing ?? { incident, status: 'open', updatedAt: new Date().toISOString(), history: [] };
    record.incident = incident;
    incidents.set(incident.id, record);
    return record;
}
export function listLocalIncidents() {
    return [...incidents.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getLocalIncident(id) {
    return incidents.get(id);
}
export function updateLocalIncidentStatus(id, status, action = status) {
    const record = incidents.get(id);
    if (!record)
        return undefined;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    record.history.push({ action, at: record.updatedAt });
    return record;
}
export function resetLocalTelegramStore() {
    incidents.clear();
}
