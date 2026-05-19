import { z } from 'zod';
const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HOST: z.string().default('0.0.0.0'),
    LOG_LEVEL: z.string().default('info'),
    DATABASE_URL: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    GITHUB_WEBHOOK_SECRET: z.string().optional(),
    GITHUB_APP_ID: z.string().optional(),
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),
    APP_BASE_URL: z.string().url().optional(),
    HMAC_SECRET: z.string().optional(),
    LOCAL_FIXTURE_MODE: z.coerce.boolean().default(false)
});
export function loadConfig(env = process.env) {
    const parsed = schema.parse(env);
    const missingForProduction = [];
    if (parsed.NODE_ENV === 'production') {
        if (!parsed.DATABASE_URL)
            missingForProduction.push('DATABASE_URL');
        if (!parsed.TELEGRAM_BOT_TOKEN)
            missingForProduction.push('TELEGRAM_BOT_TOKEN');
        if (!parsed.GITHUB_WEBHOOK_SECRET)
            missingForProduction.push('GITHUB_WEBHOOK_SECRET');
        if (!parsed.HMAC_SECRET)
            missingForProduction.push('HMAC_SECRET');
    }
    return {
        nodeEnv: parsed.NODE_ENV,
        port: parsed.PORT,
        host: parsed.HOST,
        logLevel: parsed.LOG_LEVEL,
        databaseUrl: parsed.DATABASE_URL,
        telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
        telegramWebhookSecret: parsed.TELEGRAM_WEBHOOK_SECRET,
        githubWebhookSecret: parsed.GITHUB_WEBHOOK_SECRET,
        githubAppId: parsed.GITHUB_APP_ID,
        githubAppPrivateKey: parsed.GITHUB_APP_PRIVATE_KEY,
        appBaseUrl: parsed.APP_BASE_URL,
        hmacSecret: parsed.HMAC_SECRET,
        localFixtureMode: parsed.LOCAL_FIXTURE_MODE,
        missingForProduction
    };
}
