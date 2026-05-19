import { redactSecrets } from '../observability/redaction.js';

export interface AuditEvent {
  at: string;
  actor: string;
  action: string;
  workspaceId?: string;
  target?: string;
  metadata?: unknown;
}

const events: AuditEvent[] = [];

export function recordAuditEvent(input: Omit<AuditEvent, 'at'>, now: Date = new Date()): AuditEvent {
  const event: AuditEvent = { at: now.toISOString(), ...input, metadata: input.metadata ? redactSecrets(input.metadata) : undefined };
  events.push(event);
  return event;
}

export function listAuditEvents(workspaceId?: string): AuditEvent[] {
  return events.filter((event) => !workspaceId || event.workspaceId === workspaceId).slice();
}

export function resetAuditEvents() {
  events.length = 0;
}
