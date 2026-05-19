import { ingestPushPayload, verifyGitHubSignature } from '../integrations/github/webhook.js';
export function registerGitHubRoutes(app, config) {
    app.post('/webhooks/github', async (request, reply) => {
        const event = request.headers['x-github-event'];
        if (event !== 'push')
            return reply.code(202).send({ ok: true, ignored: event ?? 'unknown' });
        const body = request.body;
        const rawBody = rawBodyFrom(body);
        const payload = parsedBodyFrom(body);
        const signature = Array.isArray(request.headers['x-hub-signature-256']) ? request.headers['x-hub-signature-256'][0] : request.headers['x-hub-signature-256'];
        const fixtureMode = config.localFixtureMode || request.headers['x-key-leak-fixture'] === 'true';
        if (!verifyGitHubSignature(rawBody, signature, config.githubWebhookSecret, fixtureMode)) {
            return reply.code(401).send({ ok: false, error: 'invalid_github_signature' });
        }
        const result = ingestPushPayload(payload, { hmacSecret: config.hmacSecret });
        return reply.code(200).send(result);
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
