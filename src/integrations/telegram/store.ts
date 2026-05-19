import type { IncidentStatus } from '../../domain/types.js';
import type { GitHubIncidentPayload } from '../github/types.js';

export interface LocalIncidentRecord {
  incident: GitHubIncidentPayload;
  status: IncidentStatus;
  updatedAt: string;
  history: Array<{ action: string; at: string }>;
}

const incidents = new Map<string, LocalIncidentRecord>();

export function upsertLocalIncident(incident: GitHubIncidentPayload): LocalIncidentRecord {
  const existing = incidents.get(incident.id);
  const record: LocalIncidentRecord = existing ?? { incident, status: 'open', updatedAt: new Date().toISOString(), history: [] };
  record.incident = incident;
  incidents.set(incident.id, record);
  return record;
}

export function listLocalIncidents(): LocalIncidentRecord[] {
  return [...incidents.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocalIncident(id: string): LocalIncidentRecord | undefined {
  return incidents.get(id);
}

export function updateLocalIncidentStatus(id: string, status: IncidentStatus, action: string = status): LocalIncidentRecord | undefined {
  const record = incidents.get(id);
  if (!record) return undefined;
  record.status = status;
  record.updatedAt = new Date().toISOString();
  record.history.push({ action, at: record.updatedAt });
  return record;
}

export function resetLocalTelegramStore() {
  incidents.clear();
}
