import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';
import { registerHealthRoutes } from './http/health.js';
import { registerGitHubRoutes } from './http/github.js';
import { registerTelegramRoutes } from './http/telegram.js';
import { registerOAuthRoutes } from './http/oauth.js';
import { registerMetricsRoutes } from './http/metrics.js';

export async function buildApp(config: AppConfig) {
  const app = Fastify({ loggerInstance: logger });
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    try {
      const raw = typeof body === 'string' ? body : body.toString('utf8');
      done(null, { __rawBody: raw, __parsed: JSON.parse(raw) });
    } catch (error) {
      done(error as Error);
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
  registerTelegramRoutes(app, config);
  registerOAuthRoutes(app, config);
  registerMetricsRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    reply.code(500).send({ ok: false, error: 'internal_error' });
  });

  return app;
}
