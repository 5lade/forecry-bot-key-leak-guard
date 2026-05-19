import pino from 'pino';
import { redactSecrets } from './observability/redaction.js';
const REDACT_PATHS = [
    'req.headers.authorization',
    'req.headers.cookie',
    'telegramBotToken',
    'githubWebhookSecret',
    'githubAppPrivateKey',
    'databaseUrl',
    '*.secret',
    '*.token',
    '*.apiKey',
    '*.password'
];
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'forecry-bot-key-leak-guard' },
    hooks: {
        logMethod(args, method) {
            method.apply(this, args.map((arg) => redactSecrets(arg)));
        }
    }
});
