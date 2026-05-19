import { createHmac } from 'node:crypto';
const DETECTORS = [
    { provider: 'openai', ruleId: 'openai-api-key', regex: /\bsk-(?!stability-)(?:proj-)?[A-Za-z0-9_-]{32,}\b/g, baseConfidence: 0.94, severity: 'critical' },
    { provider: 'anthropic', ruleId: 'anthropic-api-key', regex: /\bsk-ant-(?:api|admin|oauth)[A-Za-z0-9_-]{24,}\b/g, baseConfidence: 0.96, severity: 'critical' },
    { provider: 'gemini', ruleId: 'gemini-api-key', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g, baseConfidence: 0.93, severity: 'critical' },
    { provider: 'replicate', ruleId: 'replicate-api-token', regex: /\br8_[A-Za-z0-9]{32,}\b/g, baseConfidence: 0.92, severity: 'high' },
    { provider: 'huggingface', ruleId: 'huggingface-token', regex: /\bhf_[A-Za-z0-9]{32,}\b/g, baseConfidence: 0.92, severity: 'high' },
    { provider: 'stability', ruleId: 'stability-api-key', regex: /\bsk-stability-[A-Za-z0-9_-]{24,}\b/g, baseConfidence: 0.91, severity: 'high' },
    { provider: 'stripe', ruleId: 'stripe-secret-key', regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{24,}\b/g, baseConfidence: 0.95, severity: 'critical' },
    { provider: 'github', ruleId: 'github-pat', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g, baseConfidence: 0.95, severity: 'critical' },
    { provider: 'github', ruleId: 'github-fine-grained-pat', regex: /\bgithub_pat_[A-Za-z0-9_]{22}_[A-Za-z0-9_]{59}\b/g, baseConfidence: 0.96, severity: 'critical' },
    { provider: 'slack', ruleId: 'slack-bot-token', regex: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g, baseConfidence: 0.95, severity: 'critical' },
    { provider: 'generic', ruleId: 'generic-high-entropy-assignment', regex: /\b(?:[A-Za-z0-9]+[_-])?(?:api[_-]?key|secret|token|credential|password)\b\s*[:=]\s*['"]?([A-Za-z0-9_./+=-]{32,})['"]?/gi, baseConfidence: 0.66, severity: 'medium' }
];
const SAFE_CONTEXT = /(?:example|sample|dummy|placeholder|fake|fixture_safe|not[-_ ]?a[-_ ]?secret|safe[-_ ]?lookalike|docs?|readme|allowlist|test-only-safe)/i;
const LOW_VALUE = /^(?:x+|0+|1+|a+|z+|changeme|placeholder|example|dummy|fake|test|notasecret)$/i;
const CONTEXT_BOOST = /(?:api[_-]?key|secret|token|authorization|bearer|credential|env|process\.env|export\s+|password|private)/i;
export function scanText(input) {
    if (!input.hmacSecret || input.hmacSecret.length < 12) {
        throw new Error('hmacSecret must be at least 12 characters');
    }
    const findings = [];
    const seen = new Set();
    const lineStarts = computeLineStarts(input.content);
    for (const detector of DETECTORS) {
        const regex = new RegExp(detector.regex.source, detector.regex.flags);
        for (const match of input.content.matchAll(regex)) {
            const raw = match[1] && detector.provider === 'generic' ? match[1] : match[0];
            const index = match.index ?? 0;
            if (isAllowed(raw, input.content, index))
                continue;
            const confidence = scoreConfidence(detector.baseConfidence, raw, input.content, index, detector.provider);
            if (confidence < 0.72)
                continue;
            const fingerprint = fingerprintSecret(raw, detector.provider, input.hmacSecret);
            if (seen.has(fingerprint))
                continue;
            seen.add(fingerprint);
            const location = locate(lineStarts, index);
            findings.push({
                provider: detector.provider,
                fingerprint,
                confidence,
                severity: severityFor(detector.severity, confidence),
                lineNumber: location.lineNumber,
                columnStart: location.columnStart,
                contextExcerpt: redactExcerpt(input.content, index, raw),
                redactedSecret: redactSecret(raw),
                ruleId: detector.ruleId,
                reason: confidence >= 0.9 ? 'provider_signature_and_context' : 'high_entropy_secret_context'
            });
        }
    }
    findings.sort((a, b) => b.confidence - a.confidence || a.lineNumber - b.lineNumber);
    return { findings };
}
export function fingerprintSecret(secret, provider, hmacSecret) {
    const digest = createHmac('sha256', hmacSecret).update(`${provider}:${secret}`).digest('hex');
    return `hmac_sha256:${provider}:${digest}`;
}
export function redactSecret(secret) {
    if (secret.length <= 10)
        return '[redacted]';
    return `${secret.slice(0, Math.min(6, secret.length - 4))}…${secret.slice(-4)}`;
}
function redactExcerpt(content, index, raw) {
    const start = Math.max(0, index - 48);
    const end = Math.min(content.length, index + raw.length + 48);
    return content.slice(start, end).replaceAll(raw, redactSecret(raw)).replace(/[\r\n]+/g, ' ').trim();
}
function isAllowed(raw, content, index) {
    const normalized = raw.replace(/[^A-Za-z0-9]/g, '');
    if (LOW_VALUE.test(normalized))
        return true;
    const context = content.slice(Math.max(0, index - 96), Math.min(content.length, index + raw.length + 96));
    if (SAFE_CONTEXT.test(context))
        return true;
    return false;
}
function scoreConfidence(base, raw, content, index, provider) {
    const context = content.slice(Math.max(0, index - 96), Math.min(content.length, index + raw.length + 96));
    let score = base;
    if (CONTEXT_BOOST.test(context))
        score += 0.04;
    if (provider === 'generic') {
        score += entropyBitsPerChar(raw) > 4.2 ? 0.16 : -0.18;
        if (raw.length >= 48)
            score += 0.05;
    }
    if (/['"]/.test(context))
        score += 0.01;
    return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}
function entropyBitsPerChar(value) {
    const counts = new Map();
    for (const ch of value)
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
    let entropy = 0;
    for (const count of counts.values()) {
        const p = count / value.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}
function severityFor(base, confidence) {
    if (confidence >= 0.93)
        return base === 'medium' ? 'high' : base;
    if (confidence >= 0.84)
        return base;
    return base === 'critical' ? 'high' : base;
}
function computeLineStarts(content) {
    const starts = [0];
    for (let i = 0; i < content.length; i += 1)
        if (content[i] === '\n')
            starts.push(i + 1);
    return starts;
}
function locate(starts, index) {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (starts[mid] <= index)
            lo = mid + 1;
        else
            hi = mid - 1;
    }
    const line = Math.max(0, hi);
    return { lineNumber: line + 1, columnStart: index - starts[line] + 1 };
}
