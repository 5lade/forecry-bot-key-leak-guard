const buckets = new Map();
export function checkRateLimit(options) {
    const now = options.now ?? Date.now();
    const existing = buckets.get(options.key);
    const bucket = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : existing;
    if (bucket.count >= options.limit) {
        buckets.set(options.key, bucket);
        return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }
    bucket.count += 1;
    buckets.set(options.key, bucket);
    return { allowed: true, remaining: Math.max(0, options.limit - bucket.count), resetAt: bucket.resetAt };
}
export function resetRateLimits() {
    buckets.clear();
}
