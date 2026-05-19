import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import { logger } from './logger.js';
import { registerHealthRoutes } from './http/health.js';
import { registerGitHubRoutes } from './http/github.js';
import { registerTelegramRoutes } from './http/telegram.js';
import { registerOAuthRoutes } from './http/oauth.js';
import { registerMetricsRoutes } from './http/metrics.js';
import { registerAdminRoutes } from './http/admin.js';
import { registerBillingRoutes } from './http/billing.js';
export async function buildApp(config) {
    const app = Fastify({ loggerInstance: logger, bodyLimit: config.maxRequestBytes });
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
    await app.register(helmet, {
        global: true,
        contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } }
    });
    app.get('/', async () => ({
        service: 'Key Leak Guard',
        description: 'Telegram-first secret exposure and AI API spend watchdog.',
        docs: '/health'
    }));
    registerHealthRoutes(app, config);
    registerGitHubRoutes(app, config);
    registerTelegramRoutes(app, config);
    registerOAuthRoutes(app, config);
    registerMetricsRoutes(app);
    registerAdminRoutes(app, config);
    registerBillingRoutes(app, config);
    app.setErrorHandler((error, request, reply) => {
        request.log.error({ err: error }, 'request failed');
        if (error?.statusCode === 413 || error?.code === 'FST_ERR_CTP_BODY_TOO_LARGE')
            return reply.code(413).send({ ok: false, error: 'payload_too_large' });
        reply.code(500).send({ ok: false, error: 'internal_error' });
    });
    return app;
}
