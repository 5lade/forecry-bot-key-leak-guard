export type Plan = 'trial' | 'starter' | 'pro' | 'agency';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive' | 'snoozed';
export type FindingStatus = IncidentStatus;

export interface AccountRecord {
  id: string;
  telegramUserId: bigint;
  telegramChatId: bigint;
  displayName?: string;
  plan: Plan;
}

export interface WorkspaceRecord {
  id: string;
  accountId: string;
  name: string;
  clientName?: string;
}

export interface RepositoryRecord {
  id: string;
  workspaceId: string;
  githubRepoId: bigint;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  scanEnabled: boolean;
}

export interface FindingRecord {
  id: string;
  repositoryId: string;
  provider: string;
  fingerprint: string;
  secretHash: string;
  confidence: number;
  severity: Severity;
  filePath: string;
  lineNumber: number;
  contextExcerpt: string;
  status: FindingStatus;
}

export interface IncidentRecord {
  id: string;
  workspaceId: string;
  findingId: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  provider: string;
}
