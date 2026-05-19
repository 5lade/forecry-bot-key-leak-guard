import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { logger } from './logger.js';
import { registerHealthRoutes } from './http/health.js';
import { registerGitHubRoutes } from './http/github.js';
export async function buildApp(config) {
    const app = Fastify({ loggerInstance: logger });
    app.removeContentTypeParser('application/json');
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
        try {
            const raw = typeof body === 'string' ? body : body.toString('utf8');
            done(null, { __rawBody: raw, __parsed: JSON.parse(raw) });
        }
        catch (error) {
            done(error);
        }
    });
    await app.register(helmet, { global: true });
    app.get('/', async () => ({
        service: 'Key Leak Guard',
        description: 'Telegram-first secret exposure and AI API spend watchdog.',
        docs: '/health'
    }));
    registerHealthRoutes(app, config);
    registerGitHubRoutes(app, config);
    app.setErrorHandler((error, request, reply) => {
        request.log.error({ err: error }, 'request failed');
        reply.code(500).send({ ok: false, error: 'internal_error' });
    });
    return app;
}
