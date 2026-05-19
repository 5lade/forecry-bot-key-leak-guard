import type { Severity } from '../../domain/types.js';

export interface GitHubRepositoryRef {
  id?: number;
  full_name: string;
  default_branch?: string;
  private?: boolean;
  html_url?: string;
}

export interface GitHubChangedFile {
  filename: string;
  content?: string;
  patch?: string;
  raw_url?: string;
}

export interface GitHubCommitRef {
  id: string;
  message?: string;
  url?: string;
  added?: string[];
  modified?: string[];
  removed?: string[];
  files?: GitHubChangedFile[];
}

export interface GitHubPushPayload {
  ref: string;
  before?: string;
  after?: string;
  repository: GitHubRepositoryRef;
  pusher?: { name?: string; email?: string };
  sender?: { login?: string };
  commits: GitHubCommitRef[];
  head_commit?: GitHubCommitRef | null;
}

export interface GitHubWebhookFinding {
  provider: string;
  repo: string;
  filePath: string;
  line: number;
  confidence: number;
  severity: Severity;
  fingerprint: string;
  ruleId: string;
  redactedContext: string;
  redactedSecret: string;
  commitSha: string;
  commitUrl?: string;
}

export interface GitHubIncidentPayload {
  id: string;
  provider: string;
  repo: string;
  filePath: string;
  line: number;
  confidence: number;
  severity: Severity;
  fingerprint: string;
  ruleId: string;
  redactedContext: string;
  redactedSecret: string;
  commitSha: string;
  commitUrl?: string;
  rotationChecklist: string[];
  telegramAlert: {
    title: string;
    severity: Severity;
    repo: string;
    filePath: string;
    line: number;
    text: string;
    actions: string[];
  };
}

export interface PushIngestionResult {
  ok: true;
  event: 'push';
  repo: string;
  incidents: GitHubIncidentPayload[];
  findings: GitHubWebhookFinding[];
  durationMs: number;
}
