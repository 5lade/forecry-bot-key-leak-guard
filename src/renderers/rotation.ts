import type { GitHubIncidentPayload } from '../integrations/github/types.js';
import { rotationRunbookFor } from '../runbooks/rotation.js';
import { sanitizeTelegramText } from './alerts.js';

function escapeMarkdown(value: string): string {
  return value.replace(/([_*`\[])/g, '\\$1');
}

function first(items: string[], count = 2): string[] {
  return items.slice(0, count);
}

export function renderRotationChecklist(incident: Pick<GitHubIncidentPayload, 'provider' | 'rotationChecklist'>): string {
  const runbook = rotationRunbookFor(incident.provider);
  const lines = [
    `*${escapeMarkdown(runbook.displayName)} rotation*`,
    `Console: ${runbook.consoleUrl}`,
    '',
    '*Revoke/rotate*',
    ...first(runbook.revokeRotate).map((item) => `• ${escapeMarkdown(item)}`),
    '*Audit usage*',
    ...first(runbook.auditUsage).map((item) => `• ${escapeMarkdown(item)}`),
    '*Update + redeploy*',
    ...first([...runbook.updateDeploySecrets, ...runbook.redeploy], 3).map((item) => `• ${escapeMarkdown(item)}`),
    '*Verify*',
    ...first(runbook.verifyNoNewUsage).map((item) => `• ${escapeMarkdown(item)}`),
    '*Blast radius*',
    ...first(runbook.blastRadius).map((item) => `• ${escapeMarkdown(item)}`),
    `Docs: ${runbook.docsUrl}`
  ];
  return sanitizeTelegramText(lines.join('\n'));
}
