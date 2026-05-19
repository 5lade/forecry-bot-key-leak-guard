import type { Severity } from '../domain/types.js';

export interface AlertPolicySettings {
  workspaceId: string;
  severityThreshold: Severity;
  digestTimeUtc: string;
  reminderCadenceMinutes: number;
  repoScanEnabled: Record<string, boolean>;
  spendAnomalyMultipliers: Record<string, number>;
  updatedAt: string;
}

export interface AlertPolicyUpdate {
  severityThreshold?: Severity | string;
  digestTimeUtc?: string;
  reminderCadenceMinutes?: number | string;
  repo?: { fullName: string; enabled: boolean };
  spendAnomaly?: { provider: string; multiplier: number | string };
}

const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const VALID_SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const DEFAULT_POLICY: Omit<AlertPolicySettings, 'workspaceId' | 'updatedAt'> = {
  severityThreshold: 'high',
  digestTimeUtc: '09:00',
  reminderCadenceMinutes: 30,
  repoScanEnabled: {},
  spendAnomalyMultipliers: {}
};

const policies = new Map<string, AlertPolicySettings>();

export function getAlertPolicy(workspaceId: string): AlertPolicySettings {
  const existing = policies.get(workspaceId);
  if (existing) return clonePolicy(existing);
  const created = { workspaceId, ...DEFAULT_POLICY, updatedAt: new Date(0).toISOString() };
  policies.set(workspaceId, created);
  return clonePolicy(created);
}

export function updateAlertPolicy(workspaceId: string, update: AlertPolicyUpdate, now: Date = new Date()): AlertPolicySettings {
  const current = getAlertPolicy(workspaceId);
  const next: AlertPolicySettings = {
    ...current,
    repoScanEnabled: { ...current.repoScanEnabled },
    spendAnomalyMultipliers: { ...current.spendAnomalyMultipliers },
    updatedAt: now.toISOString()
  };

  if (update.severityThreshold !== undefined) next.severityThreshold = parseSeverity(update.severityThreshold);
  if (update.digestTimeUtc !== undefined) next.digestTimeUtc = parseDigestTime(update.digestTimeUtc);
  if (update.reminderCadenceMinutes !== undefined) next.reminderCadenceMinutes = parseReminderCadence(update.reminderCadenceMinutes);
  if (update.repo) next.repoScanEnabled[normalizeRepo(update.repo.fullName)] = update.repo.enabled;
  if (update.spendAnomaly) next.spendAnomalyMultipliers[normalizeProvider(update.spendAnomaly.provider)] = parseSpendMultiplier(update.spendAnomaly.multiplier);

  policies.set(workspaceId, next);
  return clonePolicy(next);
}

export function shouldAlertForSeverity(workspaceId: string, severity: Severity): boolean {
  const policy = getAlertPolicy(workspaceId);
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[policy.severityThreshold];
}

export function isRepoScanEnabled(workspaceId: string, repoFullName: string): boolean {
  const policy = getAlertPolicy(workspaceId);
  return policy.repoScanEnabled[normalizeRepo(repoFullName)] ?? true;
}

export function spendAnomalyThresholdFor(workspaceId: string, provider: string): number {
  const policy = getAlertPolicy(workspaceId);
  return policy.spendAnomalyMultipliers[normalizeProvider(provider)] ?? 3;
}

export function shouldSendDigestAt(workspaceId: string, hhmmUtc: string): boolean {
  return getAlertPolicy(workspaceId).digestTimeUtc === parseDigestTime(hhmmUtc);
}

export function resetAlertPolicies() {
  policies.clear();
}

export function parseSeverity(value: string): Severity {
  const normalized = value.trim().toLowerCase() as Severity;
  if (!VALID_SEVERITIES.includes(normalized)) throw new Error('invalid severity threshold: use low, medium, high, or critical');
  return normalized;
}

export function parseDigestTime(value: string): string {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error('invalid digest time: use HH:MM in UTC, for example 09:00');
  return `${match[1]!.padStart(2, '0')}:${match[2]}`;
}

export function parseReminderCadence(value: number | string): number {
  const text = String(value).trim().toLowerCase();
  const match = text.match(/^(\d+)(?:m|min|mins|minutes)?$/);
  const minutes = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw new Error('invalid reminder cadence: use 5-240 minutes, for example 30m');
  return minutes;
}

export function parseSpendMultiplier(value: number | string): number {
  const multiplier = Number(String(value).trim().replace(/x$/i, ''));
  if (!Number.isFinite(multiplier) || multiplier < 1.5 || multiplier > 100) throw new Error('invalid spend threshold: use a multiplier from 1.5x to 100x');
  return Number(multiplier.toFixed(2));
}

function clonePolicy(policy: AlertPolicySettings): AlertPolicySettings {
  return {
    ...policy,
    repoScanEnabled: { ...policy.repoScanEnabled },
    spendAnomalyMultipliers: { ...policy.spendAnomalyMultipliers }
  };
}

function normalizeRepo(value: string): string {
  const repo = value.trim().toLowerCase();
  if (!repo || !repo.includes('/')) throw new Error('invalid repo: use owner/name');
  return repo;
}

function normalizeProvider(value: string): string {
  const provider = value.trim().toLowerCase();
  if (!provider) throw new Error('invalid provider: provide a provider name like openai');
  return provider;
}
