import { createHmac, timingSafeEqual } from 'node:crypto';
import { scanText } from '../../scanner/scanner.js';
import { rotationChecklistFor } from '../../runbooks/rotation.js';
import type { GitHubChangedFile, GitHubCommitRef, GitHubIncidentPayload, GitHubPushPayload, GitHubWebhookFinding, PushIngestionResult } from './types.js';

const DEFAULT_HMAC_SECRET = 'local-fixture-hmac-secret-32-bytes';

export function verifyGitHubSignature(rawBody: string, signatureHeader: string | undefined, secret: string | undefined, fixtureMode = false): boolean {
  if (!secret) return fixtureMode;
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
  const actualHex = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(actualHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signGitHubBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

export function ingestPushPayload(payload: GitHubPushPayload, options: { hmacSecret?: string; now?: Date } = {}): PushIngestionResult {
  const started = Date.now();
  const hmacSecret = options.hmacSecret ?? process.env.HMAC_SECRET ?? DEFAULT_HMAC_SECRET;
  const findings: GitHubWebhookFinding[] = [];
  const commits = payload.commits?.length ? payload.commits : payload.head_commit ? [payload.head_commit] : [];

  for (const commit of commits) {
    for (const file of filesForCommit(commit)) {
      const content = file.content ?? file.patch;
      if (!content || wasRemoved(commit, file.filename)) continue;
      const summary = scanText({ content, filePath: file.filename, hmacSecret });
      const preferredFindings = summary.findings.filter((finding) => {
        if (finding.provider !== 'generic') return true;
        return !summary.findings.some((other) => other.provider !== 'generic' && other.lineNumber === finding.lineNumber && other.redactedSecret === finding.redactedSecret);
      });
      for (const finding of preferredFindings) {
        findings.push({
          provider: finding.provider,
          repo: payload.repository.full_name,
          filePath: file.filename,
          line: finding.lineNumber,
          confidence: finding.confidence,
          severity: finding.severity,
          fingerprint: finding.fingerprint,
          ruleId: finding.ruleId,
          redactedContext: finding.contextExcerpt,
          redactedSecret: finding.redactedSecret,
          commitSha: commit.id,
          commitUrl: commit.url
        });
      }
    }
  }

  const incidents = findings
    .filter((finding) => finding.severity === 'critical' || finding.confidence >= 0.9)
    .map((finding) => toIncident(finding));

  return {
    ok: true,
    event: 'push',
    repo: payload.repository.full_name,
    incidents,
    findings,
    durationMs: Date.now() - started
  };
}

function filesForCommit(commit: GitHubCommitRef): GitHubChangedFile[] {
  if (commit.files?.length) return commit.files;
  return [...(commit.added ?? []), ...(commit.modified ?? [])].map((filename) => ({ filename }));
}

function wasRemoved(commit: GitHubCommitRef, filename: string): boolean {
  return (commit.removed ?? []).includes(filename);
}

function toIncident(finding: GitHubWebhookFinding): GitHubIncidentPayload {
  const id = `inc_${finding.repo.replace(/[^A-Za-z0-9]+/g, '_')}_${finding.commitSha.slice(0, 12)}_${Math.abs(hashCode(finding.fingerprint))}`;
  const rotationChecklist = rotationChecklistFor(finding.provider);
  return {
    id,
    ...finding,
    rotationChecklist,
    telegramAlert: {
      title: `${finding.severity.toUpperCase()} ${finding.provider} secret detected`,
      severity: finding.severity,
      repo: finding.repo,
      filePath: finding.filePath,
      line: finding.line,
      text: `${finding.severity.toUpperCase()} ${finding.provider} credential in ${finding.repo}:${finding.filePath}:${finding.line}. Context: ${finding.redactedContext}`,
      actions: ['Acknowledge', 'Resolve', 'False positive', 'Open GitHub commit', 'Rotation checklist']
    }
  };
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return hash;
}
