import { logger } from '../logger.js';
import { incrementCounter } from './metrics.js';
const deadLetters = [];
export async function withProviderRetry(fn, options) {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 250;
    const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    const isRetryable = options.isRetryable ?? defaultRetryable;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const result = await fn();
            incrementCounter('provider_call_total', { provider: options.provider, operation: options.operation, status: 'success' });
            return result;
        }
        catch (error) {
            lastError = error;
            const retryable = attempt < maxAttempts && isRetryable(error);
            incrementCounter('provider_call_total', { provider: options.provider, operation: options.operation, status: retryable ? 'retry' : 'failure' });
            logger.warn({ err: error, provider: options.provider, operation: options.operation, attempt, retryable }, 'provider call failed');
            if (!retryable)
                break;
            await sleep(baseDelayMs * 2 ** (attempt - 1));
        }
    }
    const entry = {
        operation: options.operation,
        provider: options.provider,
        attempts: maxAttempts,
        error: errorMessage(lastError),
        createdAt: new Date().toISOString()
    };
    deadLetters.push(entry);
    options.onDeadLetter?.(entry);
    incrementCounter('dead_letter_total', { provider: options.provider, operation: options.operation });
    throw lastError;
}
export function deadLetterSnapshot() {
    return [...deadLetters];
}
export function clearDeadLettersForTests() {
    deadLetters.length = 0;
}
function defaultRetryable(error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : undefined;
    return status === 429 || (status !== undefined && status >= 500) || status === undefined;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error ?? 'unknown error');
}
