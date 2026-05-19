import { createLifecycleState, transitionIncident, upsertIncident } from '../../incidents/lifecycle.js';
const state = createLifecycleState();
export function upsertLocalIncident(incident, now = new Date()) {
    return upsertIncident(state, incident, now);
}
export function listLocalIncidents() {
    return [...state.incidentsById.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getLocalIncident(id) {
    return state.incidentsById.get(id);
}
export function updateLocalIncidentStatus(id, status, action = status, now = new Date()) {
    return transitionIncident(state, id, status, action, now);
}
export function resetLocalTelegramStore() {
    state.incidentsById.clear();
    state.incidentKeyToId.clear();
    state.suppressionsByKey.clear();
}
