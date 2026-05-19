const SECRET_KEY_PATTERN = /(token|secret|password|authorization|cookie|api[_-]?key|private[_-]?key|database[_-]?url|credential)/i;
const SECRET_VALUE_PATTERNS = [
    /gh[pousr]_[A-Za-z0-9_]{20,}/g,
    /xox[baprs]-[A-Za-z0-9-]{20,}/g,
    /AIza[0-9A-Za-z_-]{20,}/g,
    /sk-[A-Za-z0-9_-]{20,}/g,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g
];
export function redactSecrets(value) {
    return redactValue(value);
}
function redactValue(value) {
    if (typeof value === 'string')
        return redactString(value);
    if (Array.isArray(value))
        return value.map(redactValue);
    if (!value || typeof value !== 'object')
        return value;
    const output = {};
    for (const [key, child] of Object.entries(value)) {
        output[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : redactValue(child);
    }
    return output;
}
export function redactString(input) {
    return SECRET_VALUE_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), input);
}
