import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { redactSecrets } from '../observability/redaction.js';
const VERSION = 'klg:v1';
export function encryptCredentials(credentials, secret) {
    const iv = randomBytes(12);
    const key = keyFromSecret(secret);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(JSON.stringify(redactUnsafePrototype(credentials)), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.from(JSON.stringify({ v: VERSION, iv: iv.toString('base64url'), tag: tag.toString('base64url'), data: ciphertext.toString('base64url') }), 'utf8');
}
export function decryptCredentials(encrypted, secret) {
    const payload = JSON.parse(Buffer.isBuffer(encrypted) || encrypted instanceof Uint8Array ? Buffer.from(encrypted).toString('utf8') : encrypted);
    if (payload?.v !== VERSION || !payload.iv || !payload.tag || !payload.data)
        throw new Error('invalid_encrypted_credentials');
    const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(payload.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64url')), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
}
export function encryptedCredentialPreview(encrypted) {
    const value = Buffer.isBuffer(encrypted) || encrypted instanceof Uint8Array ? Buffer.from(encrypted).toString('utf8') : encrypted;
    return redactSecrets(value).replace(/"data":"[^"]+"/, '"data":"[encrypted]"');
}
function keyFromSecret(secret) {
    if (!secret || secret.length < 16)
        throw new Error('credential_encryption_secret_too_short');
    return createHash('sha256').update(`key-leak-guard-credentials:${secret}`).digest();
}
function redactUnsafePrototype(value) {
    return JSON.parse(JSON.stringify(value));
}
