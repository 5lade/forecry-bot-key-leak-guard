import type { GitHubIncidentPayload } from '../integrations/github/types.js';
import { renderRotationChecklist } from './rotation.js';

const RAW_SECRET_PATTERNS = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{16,}/g,
  /sk-ant-[A-Za-z0-9_-]{16,}/g,
  /github_pat_[A-Za-z0-9_]+/g,
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[0-9A-Za-z-]{16,}/g
];

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface RenderedTelegramAlert {
  text: string;
  parse_mode: 'Markdown';
  reply_markup: { inline_keyboard: TelegramInlineButton[][] };
}

export function renderCriticalLeakAlert(incident: GitHubIncidentPayload): RenderedTelegramAlert {
  const text = sanitizeTelegramText([
    `🚨 *${incident.severity.toUpperCase()} ${incident.provider} secret detected*`,
    `Repo: \`${incident.repo}\``,
    `Location: \`${incident.filePath}:${incident.line}\``,
    `Confidence: ${Math.round(incident.confidence * 100)}%`,
    `Context: \`${incident.redactedContext}\``,
    '',
    'Next: revoke/rotate the credential, remove it from git history if needed, and confirm once fixed.'
  ].join('\n'));

  const keyboard: TelegramInlineButton[][] = [
    [callbackButton('Acknowledge', 'acknowledge', incident.id), callbackButton('Resolve', 'resolve', incident.id)],
    [callbackButton('Snooze', 'snooze', incident.id), callbackButton('False positive', 'false_positive', incident.id)],
    [callbackButton('Rotation checklist', 'rotation_checklist', incident.id)]
  ];
  if (incident.commitUrl) keyboard.push([{ text: 'Open GitHub commit', url: incident.commitUrl }]);
  return { text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };
}

export function sanitizeTelegramText(text: string): string {
  return RAW_SECRET_PATTERNS.reduce((safe, pattern) => safe.replace(pattern, '[redacted]'), text);
}

function callbackButton(text: string, action: string, incidentId: string): TelegramInlineButton {
  return { text, callback_data: `incident:${action}:${incidentId}` };
}
