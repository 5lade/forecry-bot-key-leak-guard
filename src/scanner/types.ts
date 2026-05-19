import type { Severity } from '../domain/types.js';

export type SecretProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'replicate'
  | 'huggingface'
  | 'stability'
  | 'stripe'
  | 'github'
  | 'slack'
  | 'generic';

export interface SecretFinding {
  provider: SecretProvider;
  fingerprint: string;
  confidence: number;
  severity: Severity;
  lineNumber: number;
  columnStart: number;
  contextExcerpt: string;
  redactedSecret: string;
  ruleId: string;
  reason: string;
}

export interface ScanInput {
  content: string;
  filePath?: string;
  hmacSecret: string;
}

export interface ScanSummary {
  findings: SecretFinding[];
}
