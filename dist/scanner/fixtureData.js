function repeat(ch, length) {
    return ch.repeat(length);
}
function token(prefix, body) {
    return `${prefix}${body}`;
}
function trueCase(id, provider, label, rawSecret) {
    return { id, provider, content: `${label}=${JSON.stringify(rawSecret)}`, rawSecret, expectedFindings: 1 };
}
const trueSecrets = [
    trueCase('openai-1', 'openai', 'OPENAI_API_KEY', token('sk-proj-', 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ABCDE')),
    trueCase('openai-2', 'openai', 'token', token('sk-', 'abcDEF1234567890abcDEF1234567890abcDEF12')),
    trueCase('anthropic-1', 'anthropic', 'ANTHROPIC_API_KEY', token('sk-ant-api03-', 'abcdefghijklmnopqrstuvwxyzABCDEF1234567890')),
    trueCase('anthropic-2', 'anthropic', 'secret', token('sk-ant-admin01-', 'ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210')),
    trueCase('gemini-1', 'gemini', 'GEMINI_API_KEY', token('AIza', 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q')),
    trueCase('gemini-2', 'gemini', 'google_api_key', token('AIza', repeat('B', 35))),
    trueCase('replicate-1', 'replicate', 'REPLICATE_API_TOKEN', token('r8_', 'abcdefghijklmnopqrstuvwxyz1234567890AB')),
    trueCase('replicate-2', 'replicate', 'token', token('r8_', 'ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210')),
    trueCase('huggingface-1', 'huggingface', 'HF_TOKEN', token('hf_', 'abcdefghijklmnopqrstuvwxyz1234567890AB')),
    trueCase('huggingface-2', 'huggingface', 'authorization_bearer', token('hf_', 'ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210')),
    trueCase('stability-1', 'stability', 'STABILITY_API_KEY', token('sk-stability-', 'AbCdEfGhIjKlMnOpQrStUvWxYz123456')),
    trueCase('stability-2', 'stability', 'secret', token('sk-stability-', 'ZYXWVUTSRQPONMLKJIHGFEDCBA9876')),
    trueCase('stripe-1', 'stripe', 'STRIPE_SECRET_KEY', token('sk_live_', '51N8SecretKeyMaterialABCDEFGH123456789')),
    trueCase('stripe-2', 'stripe', 'stripeRestricted', token('rk_live_', '51N8RestrictedMaterialABCDEFGH123456789')),
    trueCase('github-1', 'github', 'GITHUB_TOKEN', token('ghp_', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJ123456')),
    trueCase('github-2', 'github', 'GITHUB_FINE_GRAINED_TOKEN', `github_pat_${repeat('A', 22)}_${repeat('B', 59)}`),
    trueCase('slack-1', 'slack', 'SLACK_BOT_TOKEN', `xoxb-${repeat('1', 12)}-${repeat('2', 12)}-abcdefghijklmnopqrstuvwx`),
    trueCase('slack-2', 'slack', 'SLACK_USER_TOKEN', `xoxp-${repeat('3', 12)}-${repeat('4', 12)}-ZYXWVUTSRQPONMLKJIHGFED`),
    trueCase('generic-1', 'generic', 'partner_secret', 'N7qR2wX9pL4mK8vB3cD6fH1jT5sY0uI2oP9aS4dF'),
    trueCase('generic-2', 'generic', 'api_key', 'QwErTy1234567890AsDfGhJkLzXcVbNm9876543210')
];
export const fixtureCases = [
    ...trueSecrets,
    ...Array.from({ length: 80 }, (_, i) => ({
        id: `safe-${String(i + 1).padStart(2, '0')}`,
        provider: 'safe',
        expectedFindings: 0,
        content: safeLookalike(i)
    }))
];
function safeLookalike(i) {
    const templates = [
        () => `example OPENAI_API_KEY=${token('sk-', 'EXAMPLE000000000000000000000000000000')} safe-lookalike`,
        () => `dummy token ${token('hf_', repeat('0', 36))} not-a-secret`,
        () => `placeholder github token ${token('ghp_', repeat('x', 36))} docs`,
        () => `fixture_safe api_key=${JSON.stringify(repeat('a', 40))}`,
        () => `sample stripe key ${token('sk_test_', repeat('0', 36))}`,
        () => `readme says export ANTHROPIC_API_KEY=${token('sk-ant-api03-', 'placeholderplaceholder')}`,
        () => `not-a-secret xoxb-${repeat('0', 12)}-${repeat('0', 12)}-${repeat('0', 24)}`,
        () => `safe-lookalike ${token('AIza', repeat('0', 35))}`,
        () => `docs replicate token ${token('r8_', repeat('0', 32))}`,
        () => 'allowlist secret=changemechangemechangemechangemechangeme'
    ];
    return `${templates[i % templates.length]()} # fixture_safe_${i}`;
}
