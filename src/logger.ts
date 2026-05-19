import pino from 'pino';

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
  base: { service: 'forecry-bot-key-leak-guard' }
});
