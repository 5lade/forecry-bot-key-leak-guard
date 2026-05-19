import { timingSafeEqual } from 'node:crypto';
export function safeEqualSecret(provided, expected) {
    if (!expected)
        return true;
    if (!provided)
        return false;
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}
