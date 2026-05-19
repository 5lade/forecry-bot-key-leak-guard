import type { Severity } from '../../domain/types.js';
import { getAlertPolicy, isRepoScanEnabled, shouldAlertForSeverity, shouldSendDigestAt, spendAnomalyThresholdFor, updateAlertPolicy } from '../../settings/alertPolicy.js';

export interface SettingsCommandContext {
  workspaceId: string;
  args: string[];
}

export function routeSettingsCommand(context: SettingsCommandContext): string {
  const [subcommand, ...rest] = context.args;
  try {
    switch ((subcommand ?? 'show').toLowerCase()) {
      case 'show':
        return renderSettings(context.workspaceId);
      case 'severity': {
        const value = rest[0];
        if (!value) return 'Usage: /settings severity <low|medium|high|critical>';
        const policy = updateAlertPolicy(context.workspaceId, { severityThreshold: value as Severity });
        return `Alert severity threshold set to ${policy.severityThreshold}. Alerts below this severity will be digested instead of sent immediately.`;
      }
      case 'digest': {
        const value = rest[0];
        if (!value) return 'Usage: /settings digest <HH:MM UTC>';
        const policy = updateAlertPolicy(context.workspaceId, { digestTimeUtc: value });
        return `Daily digest time set to ${policy.digestTimeUtc} UTC.`;
      }
      case 'reminders':
      case 'reminder': {
        const value = rest[0];
        if (!value) return 'Usage: /settings reminders <5-240m>';
        const policy = updateAlertPolicy(context.workspaceId, { reminderCadenceMinutes: value });
        return `Critical incident reminder cadence set to every ${policy.reminderCadenceMinutes} minutes.`;
      }
      case 'repo': {
        const action = rest[0]?.toLowerCase();
        const repo = rest[1];
        if ((action !== 'enable' && action !== 'disable') || !repo) return 'Usage: /settings repo <enable|disable> <owner/name>';
        updateAlertPolicy(context.workspaceId, { repo: { fullName: repo, enabled: action === 'enable' } });
        return `Repository ${repo} ${action === 'enable' ? 'enabled' : 'disabled'} for scans and immediate alerts.`;
      }
      case 'spend':
      case 'spend-threshold': {
        const provider = rest[0];
        const multiplier = rest[1];
        if (!provider || !multiplier) return 'Usage: /settings spend <provider> <multiplier>, for example /settings spend openai 3x';
        const policy = updateAlertPolicy(context.workspaceId, { spendAnomaly: { provider, multiplier: Number(multiplier.replace(/x$/i, '')) } });
        return `Spend anomaly threshold for ${provider.toLowerCase()} set to ${policy.spendAnomalyMultipliers[provider.toLowerCase()]}x.`;
      }
      default:
        return 'Unknown settings command. Try /settings, /settings severity high, /settings digest 09:00, /settings reminders 30m, /settings repo disable owner/name, or /settings spend openai 3x.';
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid settings value';
    return `Could not update settings: ${message}.`;
  }
}

export function renderSettings(workspaceId: string): string {
  const policy = getAlertPolicy(workspaceId);
  const repos = Object.entries(policy.repoScanEnabled)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repo, enabled]) => `${repo}=${enabled ? 'enabled' : 'disabled'}`)
    .join(', ') || 'all enabled';
  const spend = Object.entries(policy.spendAnomalyMultipliers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, multiplier]) => `${provider}=${multiplier}x`)
    .join(', ') || 'default 3x';
  return [
    'Key Leak Guard settings',
    `severity_threshold: ${policy.severityThreshold}`,
    `digest_time_utc: ${policy.digestTimeUtc}`,
    `reminder_cadence: ${policy.reminderCadenceMinutes}m`,
    `repo_scans: ${repos}`,
    `spend_thresholds: ${spend}`,
    'Commands: /settings severity high | /settings digest 09:00 | /settings reminders 30m | /settings repo disable owner/name | /settings spend openai 3x'
  ].join('\n');
}

export { isRepoScanEnabled, shouldAlertForSeverity, shouldSendDigestAt, spendAnomalyThresholdFor };
