# Acceptance tests for Key Leak Guard

Pass criteria for stage-6 soak:

- [ ] **Leak detection accuracy:** Given a fixture repo with 20 realistic OpenAI/Anthropic/Gemini/Replicate/Stripe-like tokens and 80 safe lookalikes, the scanner reports >=95% true positives and <=5% false positives within 60 seconds.
- [ ] **GitHub event-to-alert latency:** For a simulated GitHub push webhook containing a newly introduced secret, the bot creates a normalized incident and emits a Telegram-ready alert payload in <=30 seconds with provider, file path, line, confidence, and rotation checklist.
- [ ] **Spend spike correlation:** Given mocked provider billing snapshots with a >=3x hourly spend jump after a detected leak, the bot links the spend anomaly to the incident and escalates severity to critical with a blast-radius summary.
- [ ] **Daily digest completeness:** The daily digest includes repos scanned, incidents opened/resolved, unresolved rotation tasks, provider spend deltas, and next recommended action, with no missing required fields across 7 generated samples.
- [ ] **Operational health:** Under a 24-hour soak workload of 1,000 synthetic webhook/scan events, the service stays healthy, logs zero unhandled exceptions, and remains under 512MB RSS and 25% single-core average CPU.

3 consecutive days passing + zero crashes = early promotion to forecry.
30 days clean + final pass = standard promotion.

Fail criteria:
- > 3 crashes in any 24h
- Unresponsive > 30 min
- > 2GB RAM or 50% CPU sustained
- Output deviates from expected pattern > 20% of samples

`bin/test-completion.sh` runs deterministic fixture checks and lightweight health validation. Doctor invokes it daily during soak.
