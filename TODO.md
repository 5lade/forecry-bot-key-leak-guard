# TODO.md — Key Leak Guard Build Tickets

Rule8 format. Work top-down. Highest priority open `[ ]` ticket is next.

## P0 — Blockers

- [x] key-leak-p0-001-app-skeleton
```yaml
id: key-leak-p0-001-app-skeleton
tier: P0
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - package.json
  - tsconfig.json
  - src/index.ts
  - src/config.ts
  - src/http/health.ts
  - src/logger.ts
  - Dockerfile
test_gate: smoke
post_deploy: false
risk: low
prompt: |
  Build the Node 22 TypeScript service skeleton for Key Leak Guard. Add package.json scripts (build, start, dev, test, lint if lightweight), TypeScript config, structured logger, config loader, Fastify/Express HTTP app, /health and /ready endpoints, and Dockerfile updates so the container can start. Keep dependencies minimal and production-ready.
acceptance: |
  `npm ci`, `npm run build`, and `npm test` (or documented smoke equivalent) succeed. `node dist/index.js` starts an HTTP server, /health returns ok JSON, /ready returns ok JSON without external credentials in local mode, and Docker build succeeds.
```

- [x] key-leak-p0-002-data-model
```yaml
id: key-leak-p0-002-data-model
tier: P0
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - prisma/schema.prisma
  - src/db/*
  - src/domain/types.ts
  - .env.example
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Implement persistence for the Spec.md data model using Prisma or Drizzle with PostgreSQL. Include accounts, workspaces, github_installations, repositories, detector_rules, findings, incidents, spend_sources, spend_snapshots, spend_anomalies, suppressions, and jobs. Add migrations or schema generation instructions, DB client helper, and .env.example.
acceptance: |
  Schema validates/generates cleanly. Local tests can create an in-memory/mock or test database record path for account -> workspace -> repository -> finding -> incident. Raw secret fields are not present anywhere in the schema.
```

- [x] key-leak-p0-003-secret-safe-scanner-core
```yaml
id: key-leak-p0-003-secret-safe-scanner-core
tier: P0
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/scanner/*
  - test/fixtures/secrets/*
  - bin/run-fixture-scan.sh
test_gate: smoke
post_deploy: false
risk: high
prompt: |
  Implement the provider-aware scanner core. Add detectors for OpenAI, Anthropic, Gemini, Replicate, Hugging Face, Stability, Stripe, GitHub PATs, Slack bot tokens, and generic high-entropy candidates. Add context scoring, allowlist/safe-example filters, severity scoring, redaction, and HMAC-SHA256 fingerprinting. Never store or print raw secrets. Create deterministic fixtures with at least 20 true secrets and 80 safe lookalikes. Wire bin/run-fixture-scan.sh to output true_positive_rate=<float> false_positive_rate=<float>.
acceptance: |
  Fixture scan reports >=0.95 true_positive_rate and <=0.05 false_positive_rate. Tests verify raw fixture secrets do not appear in findings output, logs, or snapshots; only fingerprints and redacted excerpts appear.
```

- [x] key-leak-p0-004-github-webhook-foundation
```yaml
id: key-leak-p0-004-github-webhook-foundation
tier: P0
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/integrations/github/*
  - src/http/github.ts
  - test/fixtures/github-push-leak.json
  - bin/simulate-webhook.sh
test_gate: smoke
post_deploy: false
risk: high
prompt: |
  Implement GitHub webhook verification and push event ingestion. Verify signatures when GITHUB_WEBHOOK_SECRET is set; allow fixture mode for local tests. Parse push payload commits, fetch/use changed file content from fixture payload where available, pass content to scanner, and emit normalized finding/incident objects. Wire bin/simulate-webhook.sh to submit the fixture and write a Telegram-ready alert JSON.
acceptance: |
  Simulated push with a leaked key creates one critical incident payload in <=30 seconds. Payload includes provider, repo, file path, line, confidence, severity, rotation checklist, and redacted context. Invalid signatures are rejected outside fixture mode.
```

- [x] key-leak-p0-005-telegram-foundation
```yaml
id: key-leak-p0-005-telegram-foundation
tier: P0
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/integrations/telegram/*
  - src/http/telegram.ts
  - src/renderers/alerts.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Implement Telegram webhook handling, command routing, alert rendering, and inline action callbacks for Acknowledge, Resolve, Snooze, False positive, Open GitHub commit, and Rotation checklist. Include /start, /status, /incidents, /scan, /digest, and /settings command stubs with useful local-mode responses.
acceptance: |
  Unit/smoke tests render a critical leak alert without exposing the raw secret. Callback handlers update incident state in local persistence/mocks. /health remains independent of Telegram availability.
```

## P1 — Core features

- [x] key-leak-p1-001-onboarding-and-repo-sync
```yaml
id: key-leak-p1-001-onboarding-and-repo-sync
tier: P1
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/onboarding/*
  - src/integrations/github/app.ts
  - src/http/oauth.ts
  - src/integrations/telegram/commands.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Implement Telegram onboarding and GitHub App installation/repository sync flows. /start should create/find account/workspace and return setup instructions/link. OAuth/callback routes should record installation metadata and selected repositories. Support fixture/local mode without real GitHub credentials.
acceptance: |
  Local fixture flow creates account, workspace, installation, and repositories. /status shows connected repo count and open incident count. Missing credentials produce actionable setup errors, not crashes.
```

- [x] key-leak-p1-002-incident-lifecycle
```yaml
id: key-leak-p1-002-incident-lifecycle
tier: P1
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/incidents/*
  - src/jobs/reminders.ts
  - src/integrations/telegram/callbacks.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Implement incident deduplication, open/acknowledged/resolved/false_positive/snoozed states, audit trail, suppression creation, reopen behavior for recurring fingerprints, and reminder job scheduling for critical incidents.
acceptance: |
  Tests prove duplicate fingerprint+repo incidents dedupe, false positives suppress future findings, resolved incidents reopen on later recurrence, and critical unresolved reminders are scheduled at 30-minute intervals for the first 4 hours.
```

- [x] key-leak-p1-003-provider-rotation-runbooks
```yaml
id: key-leak-p1-003-provider-rotation-runbooks
tier: P1
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/runbooks/*
  - src/renderers/rotation.ts
test_gate: smoke
post_deploy: false
risk: low
prompt: |
  Add provider-specific rotation checklists and links for OpenAI, Anthropic, Gemini, Replicate, Hugging Face, Stability, Stripe, GitHub, and Slack. Include blast-radius checklist and post-rotation verification steps.
acceptance: |
  Every supported provider returns a checklist with revoke/rotate, audit usage, update deploy secrets, redeploy, and verify no new usage steps. Telegram renderer displays checklists concisely with no markdown breakage.
```

- [x] key-leak-p1-004-spend-fixtures-and-correlation
```yaml
id: key-leak-p1-004-spend-fixtures-and-correlation
tier: P1
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/spend/*
  - test/fixtures/billing-spike.json
  - bin/run-spend-correlation-fixture.sh
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Implement normalized spend snapshots, fixture/manual spend source, anomaly detection, and correlation with recent findings. A >=3x hourly spend jump after a detected leak should link to the incident and escalate severity to critical.
acceptance: |
  bin/run-spend-correlation-fixture.sh outputs severity=critical and linked_incident=true for the supplied billing-spike fixture. Non-correlated spend spikes still create spend anomalies without falsely linking to unrelated findings.
```

- [x] key-leak-p1-005-daily-digest
```yaml
id: key-leak-p1-005-daily-digest
tier: P1
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/digest/*
  - src/jobs/dailyDigest.ts
  - bin/render-digest-fixture.sh
test_gate: smoke
post_deploy: false
risk: low
prompt: |
  Implement daily digest generation and Telegram rendering. Include repos_scanned, incidents_opened, incidents_resolved, unresolved_rotation_tasks, provider_spend_deltas, top_risk, and next_recommended_action. Add fixture renderer script.
acceptance: |
  bin/render-digest-fixture.sh emits a digest containing every required field across at least 7 sample days. Telegram formatting is readable and does not leak raw secrets.
```

- [x] key-leak-p1-006-manual-scan-command
```yaml
id: key-leak-p1-006-manual-scan-command
tier: P1
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/scanner/repoScan.ts
  - src/integrations/telegram/commands.ts
  - src/jobs/repoScan.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Implement `/scan <repo|all>` manual scan command using GitHub repo content APIs or local fixtures. It should enqueue/execute scans, checkpoint progress, and send a Telegram summary with findings by severity.
acceptance: |
  Fixture manual scan completes for a sample repo under 60 seconds and reports scanned file count, findings by severity, and incident links. Unknown repo names return a clear error.
```

## P2 — Polish

- [x] key-leak-p2-001-observability-and-retries
```yaml
id: key-leak-p2-001-observability-and-retries
tier: P2
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/observability/*
  - src/jobs/*
  - src/http/metrics.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Add structured JSON logs, lightweight /metrics counters, retry/backoff for Telegram/GitHub/provider calls, queue/job locking, and dead-letter visibility. Ensure logs redact secrets and credentials.
acceptance: |
  Tests or smoke fixtures show transient provider failure retries with exponential backoff, permanent failure lands in dead-letter/error state, /metrics exposes counts, and log redaction prevents raw secrets.
```

- [x] key-leak-p2-002-settings-and-alert-policy
```yaml
id: key-leak-p2-002-settings-and-alert-policy
tier: P2
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/settings/*
  - src/integrations/telegram/settings.ts
test_gate: smoke
post_deploy: false
risk: low
prompt: |
  Implement alert policy settings for severity threshold, digest time, reminder cadence, repo enable/disable, and spend anomaly thresholds. Provide Telegram settings menus or simple commands.
acceptance: |
  Settings persist per workspace, affect alert/digest behavior, and invalid values return helpful Telegram messages.
```

- [x] key-leak-p2-003-security-hardening
```yaml
id: key-leak-p2-003-security-hardening
tier: P2
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/security/*
  - src/config.ts
  - test/security/*
test_gate: smoke
post_deploy: false
risk: high
prompt: |
  Harden webhook secret verification, credential encryption helpers, rate limits, request size limits, secure headers, audit trail, and workspace delete/purge logic. Add tests for raw secret non-persistence and credential redaction.
acceptance: |
  Invalid Telegram/GitHub webhook secrets are rejected, large payloads are capped, stored provider credentials are encrypted, delete workspace purges credentials/repo data, and tests confirm raw secrets are not persisted or logged.
```

- [x] key-leak-p2-004-acceptance-runner-completion
```yaml
id: key-leak-p2-004-acceptance-runner-completion
tier: P2
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - bin/test-completion.sh
  - bin/run-fixture-scan.sh
  - bin/simulate-webhook.sh
  - bin/run-spend-correlation-fixture.sh
  - bin/render-digest-fixture.sh
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Finish all acceptance runner scripts so bin/test-completion.sh validates the real implemented fixture paths and health endpoint without placeholder skips. It must be suitable for daily soak monitor execution inside the container.
acceptance: |
  bin/test-completion.sh returns exit 0 in a correctly configured local/container fixture environment, exercises all five acceptance criteria, and prints Result: N pass, 0 fail. It fails loudly when a required criterion regresses.
```

## P3 — Nice-to-have

- [ ] key-leak-p3-001-stripe-plan-gates
```yaml
id: key-leak-p3-001-stripe-plan-gates
tier: P3
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/billing/*
  - src/http/billing.ts
  - src/settings/planLimits.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Add Stripe Checkout/customer portal/webhook skeleton and enforce Starter/Pro/Agency repo limits. Include trial mode for users without paid subscription.
acceptance: |
  Fixture Stripe webhook updates account plan, repo limit checks block excess repos with helpful Telegram copy, and trial-only local mode still works.
```

- [ ] key-leak-p3-002-public-code-search-sweep
```yaml
id: key-leak-p3-002-public-code-search-sweep
tier: P3
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/integrations/github/codeSearch.ts
  - src/jobs/publicExposureSweep.ts
test_gate: smoke
post_deploy: false
risk: med
prompt: |
  Add optional GitHub public code search sweep for known fingerprints/provider patterns where API permissions and rate limits allow. Use aggressive rate limiting and clear unavailable-state messaging.
acceptance: |
  Sweep runs in fixture mode, respects configured rate limit, records unavailable/rate-limited state without crashing, and creates exposure incidents only for high-confidence matches.
```

- [ ] key-leak-p3-003-agency-workspaces
```yaml
id: key-leak-p3-003-agency-workspaces
tier: P3
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/workspaces/*
  - src/integrations/telegram/workspaces.ts
test_gate: smoke
post_deploy: false
risk: low
prompt: |
  Add agency/client workspace grouping UX for Telegram and repo lists, including switching active workspace and per-client digest summaries.
acceptance: |
  A user can create/select/list workspaces, assign repos to clients, and receive digest sections grouped by client.
```

- [x] key-leak-p3-004-web-admin-minimal
```yaml
id: key-leak-p3-004-web-admin-minimal
tier: P3
block: none
target: pc
cwd: /tmp/forecry-bot-key-leak-guard
target_files:
  - src/http/admin.ts
  - src/views/*
test_gate: smoke
post_deploy: false
risk: low
prompt: |
  Add a minimal authenticated web admin page for repo list, incident history, billing setup links, and provider spend source status. Keep it simple server-rendered HTML.
acceptance: |
  Admin page is protected by signed setup/session token, lists repos/incidents without raw secrets, and provides setup/status links useful during onboarding.
```
