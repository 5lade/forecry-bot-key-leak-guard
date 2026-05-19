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
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_STARTER: z.string().optional(),
    STRIPE_PRICE_PRO: z.string().optional(),
    STRIPE_PRICE_AGENCY: z.string().optional(),
    HMAC_SECRET: z.string().optional(),
    CREDENTIAL_ENCRYPTION_SECRET: z.string().optional(),
    MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
    WEBHOOK_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),
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
        if (!parsed.CREDENTIAL_ENCRYPTION_SECRET)
            missingForProduction.push('CREDENTIAL_ENCRYPTION_SECRET');
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
        stripeSecretKey: parsed.STRIPE_SECRET_KEY,
        stripeWebhookSecret: parsed.STRIPE_WEBHOOK_SECRET,
        stripePriceStarter: parsed.STRIPE_PRICE_STARTER,
        stripePricePro: parsed.STRIPE_PRICE_PRO,
        stripePriceAgency: parsed.STRIPE_PRICE_AGENCY,
        hmacSecret: parsed.HMAC_SECRET,
        credentialEncryptionSecret: parsed.CREDENTIAL_ENCRYPTION_SECRET ?? parsed.HMAC_SECRET,
        maxRequestBytes: parsed.MAX_REQUEST_BYTES,
        webhookRateLimitPerMinute: parsed.WEBHOOK_RATE_LIMIT_PER_MINUTE,
        localFixtureMode: parsed.LOCAL_FIXTURE_MODE,
        missingForProduction
    };
}
