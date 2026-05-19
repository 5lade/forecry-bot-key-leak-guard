import type { SecretProvider } from '../scanner/types.js';

export interface RotationLink {
  label: string;
  url: string;
}

export interface RotationRunbook {
  provider: SecretProvider;
  displayName: string;
  consoleUrl: string;
  docsUrl: string;
  links: RotationLink[];
  revokeRotate: string[];
  auditUsage: string[];
  updateDeploySecrets: string[];
  redeploy: string[];
  verifyNoNewUsage: string[];
  blastRadius: string[];
  postRotationVerification: string[];
}

const COMMON_UPDATE_DEPLOY_SECRETS = [
  'Update the replacement value in the production secret manager or hosting dashboard.',
  'Update CI/CD, preview, worker, and local developer secrets that used the exposed value.',
  'Remove the exposed value from committed files, issue tracker comments, logs, and runbooks.'
];

const COMMON_REDEPLOY = [
  'Redeploy every service, worker, cron, and preview environment that loads the credential.',
  'Restart long-running jobs so they stop using the revoked value.',
  'Confirm health checks and smoke tests pass after deployment.'
];

const COMMON_VERIFY = [
  'Confirm the revoked credential cannot authenticate anymore.',
  'Watch provider usage for at least 30 minutes and confirm no new calls use the old credential.',
  'Resolve the incident only after git history cleanup or explicit risk acceptance is recorded.'
];

const COMMON_BLAST_RADIUS = [
  'Identify every repository, environment, deploy target, and teammate that had access to the credential.',
  'Check whether the key could read data, write data, spend money, or administer users/apps.',
  'Review commits, logs, build artifacts, container images, and issue comments for additional copies.',
  'Decide whether customers, clients, or platform support need notification.'
];

const RUNBOOKS: Record<SecretProvider, RotationRunbook> = {
  openai: {
    provider: 'openai',
    displayName: 'OpenAI',
    consoleUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety',
    links: [
      { label: 'API keys', url: 'https://platform.openai.com/api-keys' },
      { label: 'Usage', url: 'https://platform.openai.com/usage' },
      { label: 'Limits', url: 'https://platform.openai.com/settings/organization/limits' }
    ],
    revokeRotate: ['Delete the exposed OpenAI project/user API key.', 'Create a new project-scoped key with the smallest required permissions.', 'Set project spend limits before restoring traffic.'],
    auditUsage: ['Review usage by project/model around the exposure window.', 'Check abnormal prompt, image, fine-tune, or batch usage spikes.', 'Review organization members and service accounts for unexpected access.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run a known-good API call with the replacement key.', 'Confirm dashboards show no errors from revoked-key retries.', 'Record final spend estimate for the incident.']
  },
  anthropic: {
    provider: 'anthropic',
    displayName: 'Anthropic',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com/en/api/admin-api/apikeys',
    links: [
      { label: 'API keys', url: 'https://console.anthropic.com/settings/keys' },
      { label: 'Usage', url: 'https://console.anthropic.com/settings/usage' }
    ],
    revokeRotate: ['Revoke the exposed Anthropic API key from the Console.', 'Create a replacement key for the specific workspace/project only.', 'Avoid reusing admin-level keys for application runtime traffic.'],
    auditUsage: ['Review Claude usage during the exposure window.', 'Check workspace members and key names for unexpected changes.', 'Compare token spend against normal daily baseline.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run one low-cost Claude request with the new key.', 'Confirm revoked-key attempts stop in app logs.', 'Document workspace/project impacted by the leak.']
  },
  gemini: {
    provider: 'gemini',
    displayName: 'Gemini / Google AI',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key',
    links: [
      { label: 'AI Studio keys', url: 'https://aistudio.google.com/app/apikey' },
      { label: 'Google Cloud credentials', url: 'https://console.cloud.google.com/apis/credentials' },
      { label: 'Billing', url: 'https://console.cloud.google.com/billing' }
    ],
    revokeRotate: ['Delete or restrict the exposed Gemini API key.', 'Create a replacement key restricted to required APIs and referrers/IPs where possible.', 'Disable unused Google Cloud APIs attached to the same project.'],
    auditUsage: ['Review API metrics, quota, and billing for the project.', 'Check IAM principals and API key restrictions for broad access.', 'Look for abnormal model or region usage.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run a small Gemini request with the replacement key.', 'Confirm quota graphs do not increase for the deleted key.', 'Save project ID and key ID in the incident audit.']
  },
  replicate: {
    provider: 'replicate',
    displayName: 'Replicate',
    consoleUrl: 'https://replicate.com/account/api-tokens',
    docsUrl: 'https://replicate.com/docs/topics/security/api-tokens',
    links: [
      { label: 'API tokens', url: 'https://replicate.com/account/api-tokens' },
      { label: 'Dashboard', url: 'https://replicate.com/account' }
    ],
    revokeRotate: ['Delete the exposed Replicate API token.', 'Create a replacement token for the app/service owner.', 'Consider lowering concurrency or billing exposure while investigating.'],
    auditUsage: ['Review predictions created during the exposure window.', 'Check expensive model runs and webhook destinations.', 'Compare billing and prediction counts against baseline.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run a tiny prediction with the replacement token.', 'Confirm no new predictions appear from the old token.', 'Record suspicious prediction IDs if any.']
  },
  huggingface: {
    provider: 'huggingface',
    displayName: 'Hugging Face',
    consoleUrl: 'https://huggingface.co/settings/tokens',
    docsUrl: 'https://huggingface.co/docs/hub/security-tokens',
    links: [
      { label: 'Access tokens', url: 'https://huggingface.co/settings/tokens' },
      { label: 'Billing', url: 'https://huggingface.co/settings/billing' },
      { label: 'Organizations', url: 'https://huggingface.co/organizations' }
    ],
    revokeRotate: ['Revoke the exposed Hugging Face token.', 'Create a fine-grained replacement token with read/write scope only where required.', 'Remove write/admin scope from runtime tokens unless absolutely necessary.'],
    auditUsage: ['Review Spaces, Inference Endpoints, datasets, and model repos touched by the token.', 'Check organization audit/activity for pushes or settings changes.', 'Review billing and endpoint usage.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Pull or call the expected model with the new token.', 'Confirm protected repos were not modified unexpectedly.', 'Record affected org/repo scope.']
  },
  stability: {
    provider: 'stability',
    displayName: 'Stability AI',
    consoleUrl: 'https://platform.stability.ai/account/keys',
    docsUrl: 'https://platform.stability.ai/docs/getting-started/authentication',
    links: [
      { label: 'API keys', url: 'https://platform.stability.ai/account/keys' },
      { label: 'Account', url: 'https://platform.stability.ai/account' }
    ],
    revokeRotate: ['Revoke the exposed Stability API key.', 'Create a replacement key and store it only in managed secrets.', 'Temporarily lower spending/credit exposure while reviewing usage.'],
    auditUsage: ['Review generation history and credit consumption during the exposure window.', 'Check for abnormal image/video generation volume.', 'Inspect webhook or asset destinations if configured.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run a minimal generation/auth check with the new key.', 'Confirm app logs contain no revoked-key retries.', 'Record credit impact.']
  },
  stripe: {
    provider: 'stripe',
    displayName: 'Stripe',
    consoleUrl: 'https://dashboard.stripe.com/apikeys',
    docsUrl: 'https://docs.stripe.com/keys',
    links: [
      { label: 'API keys', url: 'https://dashboard.stripe.com/apikeys' },
      { label: 'Developers logs', url: 'https://dashboard.stripe.com/logs' },
      { label: 'Balance', url: 'https://dashboard.stripe.com/balance' }
    ],
    revokeRotate: ['Roll the exposed Stripe secret/restricted key in the Dashboard.', 'Create a restricted key for runtime usage instead of a broad secret key when possible.', 'Rotate webhook signing secrets if the same repo exposed webhook config.'],
    auditUsage: ['Review Developer Logs for charges, refunds, payouts, customers, and subscriptions during exposure.', 'Check Balance, Events, and connected accounts for unexpected activity.', 'Export suspicious request IDs before retention windows expire.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run a non-mutating Stripe API call with the new key.', 'Confirm payments/webhooks still work in smoke mode.', 'Escalate immediately if unauthorized charges/refunds occurred.']
  },
  github: {
    provider: 'github',
    displayName: 'GitHub',
    consoleUrl: 'https://github.com/settings/tokens',
    docsUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    links: [
      { label: 'Personal tokens', url: 'https://github.com/settings/tokens' },
      { label: 'Fine-grained tokens', url: 'https://github.com/settings/personal-access-tokens' },
      { label: 'Org audit log', url: 'https://github.com/organizations/ORG/settings/audit-log' }
    ],
    revokeRotate: ['Revoke the exposed GitHub token immediately.', 'Create a fine-grained replacement token or GitHub App credential scoped to exact repos/permissions.', 'Rotate deploy keys or app private keys if they were exposed nearby.'],
    auditUsage: ['Review token scopes, authorized OAuth apps, SSH/deploy keys, and recent audit log events.', 'Check pushed commits, releases, packages, secrets, Actions workflows, and repo settings.', 'Look for unauthorized collaborators, webhooks, and branch protection changes.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run the intended GitHub API action with the replacement credential.', 'Confirm GitHub secret scanning alert is resolved or documented.', 'Record all repos/orgs reachable by the old token.']
  },
  slack: {
    provider: 'slack',
    displayName: 'Slack',
    consoleUrl: 'https://api.slack.com/apps',
    docsUrl: 'https://api.slack.com/authentication/token-types',
    links: [
      { label: 'Slack apps', url: 'https://api.slack.com/apps' },
      { label: 'Audit logs API', url: 'https://api.slack.com/admins/audit-logs' },
      { label: 'Token rotation docs', url: 'https://api.slack.com/authentication/rotation' }
    ],
    revokeRotate: ['Rotate or reinstall the Slack app token (bot/user/app token as applicable).', 'Revoke the exposed token from the app management page.', 'Reduce OAuth scopes before issuing the replacement token.'],
    auditUsage: ['Review app scopes, installed workspace, slash commands, event subscriptions, and webhook URLs.', 'Check audit logs for channel reads/writes, user lookups, file access, and admin changes.', 'Search for unexpected messages sent by the app.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Send a controlled test message or auth.test with the new token.', 'Confirm old-token calls return invalid_auth.', 'Notify workspace admins if sensitive channels/files may have been accessible.']
  },
  generic: {
    provider: 'generic',
    displayName: 'Generic credential',
    consoleUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    docsUrl: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    links: [{ label: 'OWASP secrets guidance', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html' }],
    revokeRotate: ['Identify the owning provider/service from surrounding context.', 'Revoke the exposed credential in that provider console.', 'Create a least-privilege replacement credential.'],
    auditUsage: ['Review provider logs and account activity during the exposure window.', 'Check whether the credential could spend money, read private data, or mutate production.', 'Escalate to the service owner if ownership is unclear.'],
    updateDeploySecrets: COMMON_UPDATE_DEPLOY_SECRETS,
    redeploy: COMMON_REDEPLOY,
    verifyNoNewUsage: COMMON_VERIFY,
    blastRadius: COMMON_BLAST_RADIUS,
    postRotationVerification: ['Run the smallest safe auth check with the replacement credential.', 'Confirm old credential fails.', 'Attach owner/provider details to the incident.']
  }
};

export const SUPPORTED_ROTATION_PROVIDERS = Object.keys(RUNBOOKS) as SecretProvider[];

export function rotationRunbookFor(provider: string): RotationRunbook {
  const normalized = provider.toLowerCase().replace(/[^a-z]/g, '') as SecretProvider;
  return RUNBOOKS[normalized] ?? RUNBOOKS.generic;
}

export function rotationChecklistFor(provider: string): string[] {
  const runbook = rotationRunbookFor(provider);
  return [
    ...runbook.revokeRotate,
    ...runbook.auditUsage,
    ...runbook.updateDeploySecrets,
    ...runbook.redeploy,
    ...runbook.verifyNoNewUsage,
    ...runbook.blastRadius,
    ...runbook.postRotationVerification
  ];
}
