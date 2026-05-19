import type { AppConfig } from '../config.js';

export function registerHealthRoutes(app: any, config: AppConfig) {
  app.get('/health', async () => ({
    ok: true,
    service: 'forecry-bot-key-leak-guard',
    version: process.env.npm_package_version ?? '0.1.0',
    uptimeSeconds: Math.round(process.uptime())
  }));

  app.get('/ready', async (_request: any, reply: any) => {
    const ready = config.nodeEnv !== 'production' || config.missingForProduction.length === 0;
    const body = {
      ok: ready,
      mode: config.nodeEnv,
      localFixtureMode: config.localFixtureMode,
      missingForProduction: config.missingForProduction
    };
    if (!ready) return reply.code(503).send(body);
    return body;
  });
}
