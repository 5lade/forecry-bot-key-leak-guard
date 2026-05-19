import type { AppConfig } from '../config.js';
import { ingestPushPayload, verifyGitHubSignature } from '../integrations/github/webhook.js';
import type { GitHubPushPayload } from '../integrations/github/types.js';

export function registerGitHubRoutes(app: any, config: AppConfig) {
  app.post('/webhooks/github', async (request: any, reply: any) => {
    const event = request.headers['x-github-event'];
    if (event !== 'push') return reply.code(202).send({ ok: true, ignored: event ?? 'unknown' });

    const body = request.body as unknown;
    const rawBody = rawBodyFrom(body);
    const payload = parsedBodyFrom(body) as GitHubPushPayload;
    const signature = Array.isArray(request.headers['x-hub-signature-256']) ? request.headers['x-hub-signature-256'][0] : request.headers['x-hub-signature-256'];
    const fixtureMode = config.localFixtureMode || request.headers['x-key-leak-fixture'] === 'true';

    if (!verifyGitHubSignature(rawBody, signature, config.githubWebhookSecret, fixtureMode)) {
      return reply.code(401).send({ ok: false, error: 'invalid_github_signature' });
    }

    const result = ingestPushPayload(payload, { hmacSecret: config.hmacSecret });
    return reply.code(200).send(result);
  });
}

function rawBodyFrom(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object' && '__rawBody' in body) return String((body as { __rawBody: string }).__rawBody);
  return JSON.stringify(body ?? {});
}

function parsedBodyFrom(body: unknown): unknown {
  if (typeof body === 'string') return JSON.parse(body);
  if (body && typeof body === 'object' && '__parsed' in body) return (body as { __parsed: unknown }).__parsed;
  return body;
}
