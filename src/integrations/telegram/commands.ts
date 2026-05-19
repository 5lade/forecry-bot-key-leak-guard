import type { AppConfig } from '../../config.js';
import type { GitHubIncidentPayload } from '../github/types.js';
import { githubCredentialStatus, githubSetupUrl } from '../github/app.js';
import { ensureTelegramWorkspace, snapshotForTelegramChat } from '../../onboarding/localStore.js';
import { listLocalIncidents } from './store.js';

export interface TelegramMessage {
  message_id?: number;
  text?: string;
  chat: { id: number | string; type?: string };
  from?: { id?: number; username?: string; first_name?: string };
}

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: TelegramMessage;
  from?: { id?: number; username?: string; first_name?: string };
}

export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export function routeTelegramCommand(message: TelegramMessage, config?: AppConfig): string {
  const command = (message.text ?? '').trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase() || '/status';
  switch (command) {
    case '/start': {
      const snapshot = ensureTelegramWorkspace({ chatId: message.chat.id, userId: message.from?.id, username: message.from?.username, firstName: message.from?.first_name });
      const setupUrl = config ? githubSetupUrl(config, snapshot.workspace.id) : `http://localhost:3000/github/install?workspace_id=${snapshot.workspace.id}`;
      const credentialStatus = config ? githubCredentialStatus(config) : { ok: true, missing: [] as string[] };
      const setupHint = credentialStatus.ok ? `Setup link: ${setupUrl}` : `${credentialStatus.message} Setup link: ${setupUrl}`;
      return `Welcome to Key Leak Guard. I created workspace ${snapshot.workspace.id}. ${setupHint} After installing the GitHub App, send /status to confirm connected repos and open incidents.`;
    }
    case '/status': {
      const snapshot = snapshotForTelegramChat(message.chat.id) ?? ensureTelegramWorkspace({ chatId: message.chat.id, userId: message.from?.id, username: message.from?.username, firstName: message.from?.first_name });
      const openIncidents = listLocalIncidents().filter((record) => record.status === 'open').length;
      const repoWord = snapshot.repositories.length === 1 ? 'repo' : 'repos';
      const installState = snapshot.installation ? `GitHub installation ${snapshot.installation.githubInstallationId.toString()} connected.` : 'GitHub App not connected yet.';
      return `Key Leak Guard local mode is online. Connected repos: ${snapshot.repositories.length} ${repoWord}. Open incidents: ${openIncidents}. ${installState}`;
    }
    case '/incidents': {
      const open = listLocalIncidents().filter((record) => record.status !== 'resolved' && record.status !== 'false_positive');
      if (!open.length) return 'No active incidents in local persistence.';
      return open.map((record) => `${record.incident.id}: ${record.incident.severity} ${record.incident.provider} in ${record.incident.repo}:${record.incident.filePath}:${record.incident.line} (${record.status})`).join('\n');
    }
    case '/scan':
      return 'Manual scan stub: repo scan scheduling will run in the next core-feature ticket. For now, use the GitHub webhook fixture or /status.';
    case '/digest':
      return `Digest stub: ${listLocalIncidents().length} total incident(s) tracked locally.`;
    case '/settings':
      return 'Settings stub: alerts are enabled for critical/high leaks; snooze defaults to 24h in local mode.';
    default:
      return 'Unknown command. Try /status, /incidents, /scan, /digest, or /settings.';
  }
}

export function sampleIncidentForTelegram(): GitHubIncidentPayload {
  return {
    id: 'inc_local_fixture_telegram',
    provider: 'openai',
    repo: 'demo/key-leak-guard-fixture',
    filePath: 'src/config.ts',
    line: 2,
    confidence: 0.97,
    severity: 'critical',
    fingerprint: 'hmac_sha256:openai:fixture',
    ruleId: 'openai-api-key',
    redactedContext: 'OPENAI_API_KEY="sk-proj…BCDE"',
    redactedSecret: 'sk-proj…BCDE',
    commitSha: 'abc123def456',
    commitUrl: 'https://github.com/demo/key-leak-guard-fixture/commit/abc123def456',
    rotationChecklist: ['Revoke the exposed OpenAI key', 'Create a replacement key', 'Move it to a secret store', 'Audit recent usage'],
    telegramAlert: {
      title: 'CRITICAL openai secret detected',
      severity: 'critical',
      repo: 'demo/key-leak-guard-fixture',
      filePath: 'src/config.ts',
      line: 2,
      text: 'CRITICAL openai credential detected in demo/key-leak-guard-fixture',
      actions: ['Acknowledge', 'Resolve', 'Snooze', 'False positive', 'Open GitHub commit', 'Rotation checklist']
    }
  };
}
