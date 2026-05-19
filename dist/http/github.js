import { ingestPushPayload, verifyGitHubSignature } from '../integrations/github/webhook.js';
import { upsertLocalIncident } from '../integrations/telegram/store.js';
import { checkRateLimit, recordAuditEvent } from '../security/index.js';
export function registerGitHubRoutes(app, config) {
    app.post('/webhooks/github', async (request, reply) => {
        const rate = checkRateLimit({ key: `github:${request.ip}`, limit: config.webhookRateLimitPerMinute, windowMs: 60_000 });
        if (!rate.allowed)
            return reply.code(429).header('retry-after', Math.ceil((rate.resetAt - Date.now()) / 1000)).send({ ok: false, error: 'rate_limited' });
        const event = request.headers['x-github-event'];
        if (event !== 'push')
            return reply.code(202).send({ ok: true, ignored: event ?? 'unknown' });
        const body = request.body;
        const rawBody = rawBodyFrom(body);
        const payload = parsedBodyFrom(body);
        const signature = Array.isArray(request.headers['x-hub-signature-256']) ? request.headers['x-hub-signature-256'][0] : request.headers['x-hub-signature-256'];
        const fixtureMode = config.localFixtureMode || request.headers['x-key-leak-fixture'] === 'true';
        if (!verifyGitHubSignature(rawBody, signature, config.githubWebhookSecret, fixtureMode)) {
            recordAuditEvent({ actor: 'github-webhook', action: 'webhook_signature_rejected', metadata: { event, ip: request.ip } });
            return reply.code(401).send({ ok: false, error: 'invalid_github_signature' });
        }
        const result = ingestPushPayload(payload, { hmacSecret: config.hmacSecret });
        const incidentRecords = result.incidents.map((incident) => upsertLocalIncident(incident));
        if (result.incidents.length)
            recordAuditEvent({ actor: 'github-webhook', action: 'incidents_created', target: result.repo, metadata: { count: result.incidents.length } });
        return reply.code(200).send({ ...result, incidentRecords: incidentRecords.map((record) => ({ id: record.incident.id, status: record.status, occurrenceCount: record.occurrenceCount, suppressed: record.suppressed ?? false })) });
    });
}
function rawBodyFrom(body) {
    if (typeof body === 'string')
        return body;
    if (body && typeof body === 'object' && '__rawBody' in body)
        return String(body.__rawBody);
    return JSON.stringify(body ?? {});
}
function parsedBodyFrom(body) {
    if (typeof body === 'string')
        return JSON.parse(body);
    if (body && typeof body === 'object' && '__parsed' in body)
        return body.__parsed;
    return body;
}
