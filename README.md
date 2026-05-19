# Key Leak Guard

> Telegram-first secret exposure and AI API spend watchdog for indie builders.

A Forecry Bot Factory production. developer-security-ai-cost-control.

## What it does

Telegram-first secret exposure and AI API spend watchdog for indie builders. Subscribers connect GitHub repos/orgs and optionally paste provider billing endpoints for OpenAI, Anthropic, Gemini, Replicate, and Stripe metered AI products; the bot scans new commits, issues, logs pasted into GitHub Actions artifacts where accessible, and public code search for leaked keys, then correlates alerts with sudden token/spend spikes. Each alert includes the suspected key/provider, commit or public-search URL, blast-radius checklist, and one-tap rotation/runbook links. Daily digest shows repos scanned, near-misses, provider spend deltas, and unresolved rotation tasks.

## Why someone pays for it

A single leaked AI key can create $5k-$80k surprise bills; solo founders will pay $19-49/mo for immediate Telegram alerts before scrapers burn the key.

## Quickstart

```bash
docker build -t forecry-bot-key-leak-guard .
docker run -d --name key-leak-guard -e API_KEY=... forecry-bot-key-leak-guard
```

## Spec

See [spec.md](./spec.md). Legacy repos may still have `Spec.md`; new factory output should use lowercase `spec.md`.

## Acceptance tests

See [acceptance-tests.md](./acceptance-tests.md). Run via `bin/test-completion.sh`.
