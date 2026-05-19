import { checkRateLimit } from '../../security/rateLimit.js';
const PROVIDER_SEARCH_PATTERNS = {
    openai: 'sk-proj OR sk-',
    anthropic: 'sk-ant-api OR sk-ant-admin OR sk-ant-oauth',
    gemini: 'AIza',
    replicate: 'r8_',
    huggingface: 'hf_',
    stability: 'sk-stability-',
    stripe: 'sk_live OR rk_live',
    github: 'ghp_ OR github_pat_',
    slack: 'xoxb- OR xoxp-',
    generic: 'api_key OR secret OR token'
};
export function knownProviderQuery(provider, repo) {
    return { provider, pattern: PROVIDER_SEARCH_PATTERNS[provider] ?? `${provider} secret`, repo };
}
export function fixturePublicCodeSearchClient(items) {
    return {
        async search(query) {
            const needles = query.pattern.toLowerCase().split(/\s+OR\s+|\s+/i).filter(Boolean);
            return items.filter((item) => {
                if (query.repo && item.repo.toLowerCase() !== query.repo.toLowerCase())
                    return false;
                const haystack = `${item.repo} ${item.path} ${item.text ?? ''}`.toLowerCase();
                return needles.some((needle) => haystack.includes(needle.toLowerCase()));
            });
        }
    };
}
export async function runPublicCodeSearch(queries, options = {}) {
    const enabled = options.enabled ?? Boolean(options.token || options.client);
    if (!enabled) {
        return { ok: false, state: 'unavailable', message: 'Public GitHub code search is disabled. Set GITHUB_PUBLIC_CODE_SEARCH_ENABLED=true and provide a token, or run fixture mode.', attemptedQueries: 0 };
    }
    const limit = Math.max(1, options.rateLimitPerMinute ?? 6);
    const client = options.client ?? (options.token ? new GitHubApiCodeSearchClient(options.token, options.fetchImpl) : undefined);
    if (!client) {
        return { ok: false, state: 'unavailable', message: 'Public GitHub code search needs either a configured GitHub token or a fixture client.', attemptedQueries: 0 };
    }
    const items = [];
    let attemptedQueries = 0;
    let remainingRequests = limit;
    for (const query of queries) {
        const gate = checkRateLimit({ key: 'github-public-code-search', limit, windowMs: 60_000, now: options.now });
        remainingRequests = gate.remaining;
        if (!gate.allowed) {
            return { ok: false, state: 'rate_limited', message: 'Public GitHub code search rate limit reached; sweep will retry later.', retryAfterMs: Math.max(0, gate.resetAt - (options.now ?? Date.now())), attemptedQueries };
        }
        attemptedQueries += 1;
        const found = await client.search(query);
        items.push(...found);
    }
    return { ok: true, state: 'completed', attemptedQueries, remainingRequests, items: dedupeItems(items) };
}
function dedupeItems(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item.repo}:${item.path}:${item.sha ?? item.htmlUrl ?? ''}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
class GitHubApiCodeSearchClient {
    token;
    fetchImpl;
    constructor(token, fetchImpl = fetch) {
        this.token = token;
        this.fetchImpl = fetchImpl;
    }
    async search(query) {
        const search = `${query.pattern}${query.repo ? ` repo:${query.repo}` : ''}`;
        const url = new URL('https://api.github.com/search/code');
        url.searchParams.set('q', search);
        url.searchParams.set('per_page', '10');
        const response = await this.fetchImpl(url, {
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${this.token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'forecry-key-leak-guard'
            }
        });
        if (response.status === 403 || response.status === 429)
            throw new Error('github_code_search_rate_limited');
        if (!response.ok)
            throw new Error(`github_code_search_unavailable:${response.status}`);
        const body = await response.json();
        return (body.items ?? []).map((item) => ({
            repo: item.repository?.full_name ?? query.repo ?? 'unknown/unknown',
            path: item.path,
            sha: item.sha,
            htmlUrl: item.html_url
        }));
    }
}
