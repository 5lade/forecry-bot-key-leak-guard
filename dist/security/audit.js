import { redactSecrets } from '../observability/redaction.js';
const events = [];
export function recordAuditEvent(input, now = new Date()) {
    const event = { at: now.toISOString(), ...input, metadata: input.metadata ? redactSecrets(input.metadata) : undefined };
    events.push(event);
    return event;
}
export function listAuditEvents(workspaceId) {
    return events.filter((event) => !workspaceId || event.workspaceId === workspaceId).slice();
}
export function resetAuditEvents() {
    events.length = 0;
}
