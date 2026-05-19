import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';
import { registerHealthRoutes } from './http/health.js';

export async function buildApp(config: AppConfig) {
  const app = Fastify({ loggerInstance: logger });
  await app.register(helmet, { global: true });

  app.get('/', async () => ({
    service: 'Key Leak Guard',
    description: 'Telegram-first secret exposure and AI API spend watchdog.',
    docs: '/health'
  }));

  registerHealthRoutes(app, config);

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    reply.code(500).send({ ok: false, error: 'internal_error' });
  });

  return app;
}
