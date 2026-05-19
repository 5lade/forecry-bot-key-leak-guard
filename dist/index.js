import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { logger } from './logger.js';
const config = loadConfig();
const app = await buildApp(config);
const shutdown = async (signal) => {
    logger.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
try {
    await app.listen({ port: config.port, host: config.host });
    logger.info({ port: config.port, host: config.host }, 'Key Leak Guard service started');
}
catch (err) {
    logger.error({ err }, 'failed to start service');
    process.exit(1);
}
