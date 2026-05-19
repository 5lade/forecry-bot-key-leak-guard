# Spec.md — Key Leak Guard

## 1. Product summary

**Key Leak Guard** is a Telegram-first secret exposure and AI API spend watchdog for indie builders, small agencies, and AI SaaS founders. Customers connect GitHub repositories and optional provider billing/read-only usage sources. The bot continuously scans repository events, code snapshots, public exposure surfaces, and provider spend deltas for leaked API keys or suspicious usage spikes. When risk appears, it sends a concise Telegram incident with the suspected provider, affected repo/file/line, confidence, blast radius, exact rotation checklist, and follow-up reminders until the key is confirmed rotated.

Positioning: "Catch leaked AI keys before scrapers turn them into a surprise bill."

## 2. Target customers and pain

### Primary users
- Solo founders building AI wrappers with OpenAI, Anthropic, Gemini, Replicate, Stability, Stripe, and GitHub secrets.
- Small SaaS teams without a dedicated security engineer.
- AI agencies managing multiple client repos and provider keys.
- Developer communities that want a lightweight guardrail before public launches.

### Jobs to be done
- "When I accidentally commit a key, alert me in Telegram before scanners abuse it."
- "When my AI bill suddenly spikes, tell me whether it correlates with a leak."
- "Give me a simple rotation/runbook checklist, not a generic security dashboard."
- "Remind me until I actually close the incident."

## 3. Success metrics

### Customer/product
- >=60% of trial users connect at least one GitHub repo and one alert destination within 10 minutes.
- >=25% trial-to-paid conversion for users with >=3 repos connected.
- Median alert triage time under 2 minutes from Telegram open to first action.
- >=80% of incidents receive a resolved/ignored status within 24 hours.

### Technical/operational
- Push webhook to Telegram alert p95 <=30 seconds.
- Scanner true positive rate >=95% on maintained secret fixtures; false positive rate <=5%.
- Daily digest delivery success >=99%.
- Background scan p95 <=10 minutes for repos under 100MB.
- Service uptime >=99.5% during soak and production.

## 4. MVP scope

### In MVP
1. Telegram onboarding and alert delivery.
2. GitHub App OAuth/install flow for repository access.
3. Secret scanning on push events, manual scan command, and scheduled daily drift scan.
4. Provider-aware detectors for OpenAI, Anthropic, Gemini, Replicate, Hugging Face, Stability, Stripe, GitHub PATs, Slack bot tokens, and generic high-entropy secrets.
5. Incident lifecycle: open, acknowledge, resolved, ignored false positive, snooze.
6. Rotation checklists tailored by provider.
7. Optional provider spend import via manually pasted API keys or read-only exports for OpenAI/Anthropic where APIs allow; mocked/adaptable interfaces for providers without stable billing APIs.
8. Spend anomaly detection and correlation with recent leaks.
9. Daily digest: scans, incidents, unresolved rotation tasks, spend deltas.
10. Admin dashboard minimal web page for GitHub App callback, billing, repo list, and incident history.

### Cut from MVP
- Browser extension scanning.
- Deep GitHub Actions artifact scraping beyond accessible metadata/log hooks.
- Automatic provider key rotation.
- Enterprise SSO/SAML.
- Native Slack/Discord delivery, except webhook abstraction designed for later.

## 5. Core user stories

### Onboarding
- As a founder, I can start the bot in Telegram and receive a setup link.
- As a founder, I can install the GitHub App on selected repos only.
- As a founder, I can choose alert severity thresholds and digest time.
- As an agency owner, I can group repos by client/workspace.

### Detection
- As a founder, I receive an alert when a commit introduces a likely secret.
- As a founder, I receive a lower-severity warning when a suspicious token-like string appears but confidence is medium.
- As a founder, I can run `/scan repo-name` from Telegram and get a summary.
- As a founder, I can mark a finding as false positive and suppress that fingerprint.

### Incident response
- As a founder, I get provider-specific rotation steps and links.
- As a founder, I can tap `Acknowledge`, `Resolve`, `Snooze 1h`, or `False positive` in Telegram.
- As a founder, I get reminders for critical unresolved incidents every 30 minutes for 4 hours, then daily.
- As a founder, I can see all open incidents with `/incidents`.

### Spend monitoring
- As a founder, I can connect read-only spend sources or upload/export billing data.
- As a founder, I get an alert when hourly spend exceeds a configurable multiple or absolute amount.
- As a founder, if a spend spike follows a detected leak, I get a critical escalation with suspected blast radius.

### Digest
- As a founder, I get a daily Telegram digest showing repos scanned, incidents opened/resolved, unresolved rotation tasks, provider spend deltas, and recommended next action.

## 6. Architecture

### Runtime components
- **Bot API service**: Node.js/TypeScript HTTP service exposing Telegram webhook, GitHub webhook, OAuth callback, health endpoints, and small HTML admin pages.
- **Telegram adapter**: Handles commands, inline keyboards, callback queries, and message rendering.
- **GitHub adapter**: GitHub App installation flow, webhook verification, repo metadata sync, commit diff fetching, optional code search/public exposure checks.
- **Scanner engine**: Provider regex detectors, entropy scoring, allowlist/suppression, context scoring, fingerprinting, and severity calculation.
- **Incident service**: Deduplication, lifecycle state, reminder scheduling, audit trail.
- **Spend service**: Provider usage connectors, normalized spend snapshots, anomaly detection, correlation engine.
- **Scheduler/worker**: Daily scans, daily digests, reminders, retry queue.
- **Persistence**: PostgreSQL for accounts/repos/incidents/snapshots; Redis optional for queues/rate limits, but MVP can use Postgres-backed jobs.
- **Observability**: Structured JSON logs, `/health`, `/ready`, `/metrics` lightweight counters.

### Suggested stack
- Node 22, TypeScript, Fastify or Express.
- grammy or telegraf for Telegram.
- @octokit/webhooks + @octokit/app for GitHub.
- Prisma or Drizzle with PostgreSQL.
- node-cron or BullMQ if Redis is available; otherwise Postgres job table.
- Vitest for unit/integration tests.
- Docker image published to GHCR by existing workflow.

## 7. Data model

### accounts
- id UUID pk
- telegram_user_id bigint unique
- telegram_chat_id bigint
- display_name text
- plan enum: trial, starter, pro, agency
- trial_ends_at timestamptz
- created_at/updated_at

### workspaces
- id UUID pk
- account_id fk
- name text
- digest_time_utc text
- alert_policy jsonb

### github_installations
- id UUID pk
- workspace_id fk
- installation_id bigint unique
- account_login text
- permissions jsonb
- status enum active/suspended/deleted
- created_at/updated_at

### repositories
- id UUID pk
- workspace_id fk
- github_installation_id fk
- github_repo_id bigint unique
- full_name text
- default_branch text
- private boolean
- scan_enabled boolean
- last_scan_at timestamptz
- created_at/updated_at

### detector_rules
- id text pk
- provider text
- regex text
- entropy_threshold numeric
- severity_base enum low/medium/high/critical
- enabled boolean
- version text

### findings
- id UUID pk
- repository_id fk
- provider text
- detector_id text
- fingerprint text indexed
- secret_hash text (never store raw secret)
- confidence numeric
- severity enum low/medium/high/critical
- file_path text
- line_number int
- commit_sha text
- context_excerpt text redacted
- first_seen_at/last_seen_at
- status enum open/acknowledged/resolved/false_positive/snoozed
- suppression_id nullable

### incidents
- id UUID pk
- workspace_id fk
- finding_id fk nullable
- spend_anomaly_id fk nullable
- title text
- severity enum
- status enum open/acknowledged/resolved/false_positive/snoozed
- provider text
- blast_radius jsonb
- rotation_checklist jsonb
- telegram_message_id bigint nullable
- created_at/updated_at/resolved_at

### spend_sources
- id UUID pk
- workspace_id fk
- provider text
- auth_type enum api_key/manual/import/mock
- encrypted_credentials bytea nullable
- status enum active/error/disabled
- last_sync_at timestamptz

### spend_snapshots
- id UUID pk
- spend_source_id fk
- provider text
- period_start/period_end timestamptz
- amount_usd numeric
- usage_units numeric nullable
- raw jsonb

### spend_anomalies
- id UUID pk
- workspace_id fk
- provider text
- baseline_usd numeric
- observed_usd numeric
- multiplier numeric
- severity enum
- linked_finding_id nullable
- created_at

### suppressions
- id UUID pk
- workspace_id fk
- fingerprint text
- reason text
- created_by text
- expires_at nullable

### jobs
- id UUID pk
- type text
- payload jsonb
- run_at timestamptz
- attempts int
- last_error text
- locked_at nullable
- completed_at nullable

## 8. Detection design

### Secret detectors
- Provider regexes for known key formats.
- Generic detector: high entropy, token length, nearby variable names (`api_key`, `secret`, `token`, `bearer`, provider names), and negative context filters (`example`, `dummy`, `test`, docs fixtures).
- Never store raw secret. Compute HMAC-SHA256 fingerprint with server secret plus provider namespace.
- Redact context to first/last 4 chars where safe.

### Severity scoring
- Critical: high-confidence live provider key in default branch or public repo; or spend anomaly correlated within 24h.
- High: high-confidence key in private repo push.
- Medium: generic high entropy token with suspicious context.
- Low: detector match in docs/tests/examples with weak confidence.

### Deduplication
- Fingerprint + repo + provider dedupes repeated commits.
- Reopen resolved incident if same fingerprint appears after resolution.
- Suppressions override future matches until expiry.

## 9. Integrations

### Telegram
Commands:
- `/start` onboarding and setup link.
- `/status` workspace health, repos, open incidents.
- `/scan <repo|all>` manual scan.
- `/incidents` open incidents.
- `/digest` immediate digest preview.
- `/settings` alert thresholds and digest time.

Inline buttons:
- Acknowledge
- Resolve
- Snooze 1h / 24h
- False positive
- Open GitHub commit
- Rotation checklist

### GitHub
- GitHub App permissions: contents read, metadata read, webhooks, optional secret scanning alerts read if available.
- Webhook events: push, installation, installation_repositories, repository, check_suite optional.
- API usage must obey rate limits, cache repo metadata, and back off.

### Billing/spend providers
- OpenAI/Anthropic/Gemini/Replicate connectors should be interfaces with mocked fixture support first.
- Where official billing APIs are limited, support manual CSV/JSON import or user-provided usage endpoint configuration.
- Store credentials encrypted using an app-level key. Never log credentials.

### Stripe/payment
- Starter: $19/mo, 10 repos, Telegram alerts, daily digest.
- Pro: $49/mo, 50 repos, spend correlation, agency workspace.
- Agency: $149/mo, 250 repos, client grouping, priority reminders.
- Billing pages can be a minimal Stripe Checkout + webhook in MVP; feature gates by plan.

## 10. Alert formats

### Critical leak alert
Fields:
- Emoji/severity and provider.
- Repo, branch, file, line, commit URL.
- Confidence and why matched.
- Whether repo is public/private.
- Spend correlation if present.
- Blast-radius checklist.
- Inline actions.

Example:
`🚨 Critical: OpenAI key likely leaked in acme/app src/config.ts:42. Confidence 98%. Public repo. Spend is 4.2x baseline since commit. Rotate key, revoke old key, check usage dashboard, audit deploy secrets.`

### Daily digest
Required fields:
- repos_scanned
- incidents_opened
- incidents_resolved
- unresolved_rotation_tasks
- provider_spend_deltas
- top_risk
- next_recommended_action

## 11. Security and privacy

- Do not store raw secrets; only HMAC fingerprints and redacted excerpts.
- Encrypt provider credentials at rest.
- Verify Telegram secret token and GitHub webhook signatures.
- Principle of least privilege for GitHub App.
- Audit all incident state changes.
- Provide delete workspace command that purges credentials and repo data.
- Avoid posting full secret values in Telegram.
- Rate-limit commands and webhooks per workspace.

## 12. Operational behavior

- `/health` returns process health and dependency status.
- `/ready` checks DB migrations and queue health.
- Structured logs include workspace_id/repo_id/incident_id, never raw secrets.
- Retry transient GitHub/Telegram/provider errors with exponential backoff.
- On Telegram send failure, keep incident open and retry.
- Background scans should be interruptible and checkpointed per repo.

## 13. Implementation tickets guidance

P0 should establish TypeScript app skeleton, DB schema/migrations, Telegram webhook, GitHub webhook verification, scanner core, and Docker health. P1 should implement onboarding, repo sync, push scanning, incident creation, Telegram alerts/actions, spend fixtures/correlation, and digest. P2 should harden retries, observability, false-positive suppression, and tests. P3 can add richer provider connectors, public code search, Stripe plan gates, and agency polish.

## 14. Acceptance criteria for soak

1. **Leak detection accuracy:** Given a fixture repo with 20 realistic OpenAI/Anthropic/Gemini/Replicate/Stripe-like tokens and 80 safe lookalikes, the scanner reports >=95% true positives and <=5% false positives within 60 seconds.
2. **GitHub event-to-alert latency:** For a simulated GitHub push webhook containing a newly introduced secret, the bot creates a normalized incident and emits a Telegram-ready alert payload in <=30 seconds with provider, file path, line, confidence, and rotation checklist.
3. **Spend spike correlation:** Given mocked provider billing snapshots with a >=3x hourly spend jump after a detected leak, the bot links the spend anomaly to the incident and escalates severity to critical with a blast-radius summary.
4. **Daily digest completeness:** The daily digest includes repos scanned, incidents opened/resolved, unresolved rotation tasks, provider spend deltas, and next recommended action, with no missing required fields across 7 generated samples.
5. **Operational health:** Under a 24-hour soak workload of 1,000 synthetic webhook/scan events, the service stays healthy, logs zero unhandled exceptions, and remains under 512MB RSS and 25% single-core average CPU.

## 15. Launch checklist

- GitHub App credentials configured.
- Telegram bot token and webhook secret configured.
- Postgres migrations applied.
- Fixture tests pass in CI and container.
- `/health` reachable from soak host.
- Daily digest sample approved.
- Stripe products configured or trial-only flag enabled.
