import type { IncidentStatus } from '../../domain/types.js';
import { createLifecycleState, transitionIncident, upsertIncident, type LifecycleIncidentRecord } from '../../incidents/lifecycle.js';
import type { GitHubIncidentPayload } from '../github/types.js';

export type LocalIncidentRecord = LifecycleIncidentRecord;

const state = createLifecycleState();

export function upsertLocalIncident(incident: GitHubIncidentPayload, now: Date = new Date()): LocalIncidentRecord {
  return upsertIncident(state, incident, now);
}

export function listLocalIncidents(): LocalIncidentRecord[] {
  return [...state.incidentsById.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocalIncident(id: string): LocalIncidentRecord | undefined {
  return state.incidentsById.get(id);
}

export function updateLocalIncidentStatus(id: string, status: IncidentStatus, action: string = status, now: Date = new Date()): LocalIncidentRecord | undefined {
  return transitionIncident(state, id, status, action, now);
}

export function resetLocalTelegramStore() {
  state.incidentsById.clear();
  state.incidentKeyToId.clear();
  state.suppressionsByKey.clear();
}
