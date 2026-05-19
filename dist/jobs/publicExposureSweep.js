import { rotationChecklistFor } from '../runbooks/rotation.js';
import { scanText } from '../scanner/scanner.js';
import { upsertLocalIncident } from '../integrations/telegram/store.js';
import { knownProviderQuery, runPublicCodeSearch } from '../integrations/github/codeSearch.js';
const DEFAULT_HMAC_SECRET = 'local-fixture-hmac-secret-32-bytes';
export async function runPublicExposureSweep(options) {
    const fixtureMode = options.fixtureMode ?? false;
    const queries = buildQueries(options.knownSignals);
    if (!queries.length) {
        return completed('No known provider signals are available for public exposure sweep.', 0, [], 0);
    }
    const search = await runPublicCodeSearch(queries, {
        enabled: options.enabled ?? fixtureMode,
        token: options.token ?? process.env.GITHUB_TOKEN,
        rateLimitPerMinute: options.rateLimitPerMinute,
        now: options.now?.getTime(),
        client: options.client ?? (fixtureMode ? fixtureClient(options.fixtureItems ?? defaultFixtureItems()) : undefined)
    });
    if (!search.ok) {
        return {
            ok: false,
            state: search.state,
            message: search.message,
            attemptedQueries: search.attemptedQueries,
            searchedItems: 0,
            incidentsCreated: 0,
            incidents: [],
            unavailableReason: search.message,
            rateLimitRetryAfterMs: search.retryAfterMs
        };
    }
    const hmacSecret = options.hmacSecret ?? process.env.HMAC_SECRET ?? DEFAULT_HMAC_SECRET;
    const incidents = [];
    for (const item of search.items) {
        if (!item.text)
            continue;
        const summary = scanText({ content: item.text, filePath: item.path, hmacSecret });
        for (const finding of summary.findings.filter(isHighConfidenceExposure)) {
            if (!matchesKnownSignals(finding, options.knownSignals))
                continue;
            const incident = exposureFindingToIncident(item, finding, options.now ?? new Date());
            upsertLocalIncident(incident, options.now ?? new Date());
            incidents.push(incident);
        }
    }
    return completed(`Public exposure sweep completed: ${incidents.length} high-confidence incident(s) created.`, search.attemptedQueries, incidents, search.items.length);
}
function completed(message, attemptedQueries, incidents, searchedItems) {
    return { ok: true, state: 'completed', message, attemptedQueries, searchedItems, incidentsCreated: incidents.length, incidents };
}
function buildQueries(signals) {
    const seen = new Set();
    const queries = [];
    for (const signal of signals) {
        const query = signal.pattern
            ? { provider: signal.provider, fingerprint: signal.fingerprint, pattern: signal.pattern, repo: signal.repo }
            : knownProviderQuery(signal.provider, signal.repo);
        const key = `${query.provider}:${query.pattern}:${query.repo ?? '*'}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        queries.push(query);
    }
    return queries;
}
function isHighConfidenceExposure(finding) {
    return finding.confidence >= 0.9 || finding.severity === 'critical';
}
function matchesKnownSignals(finding, signals) {
    return signals.some((signal) => {
        if (signal.provider !== finding.provider)
            return false;
        if (signal.fingerprint && signal.fingerprint !== finding.fingerprint)
            return false;
        return true;
    });
}
function exposureFindingToIncident(item, finding, now) {
    const id = `inc_public_${item.repo.replace(/[^A-Za-z0-9]+/g, '_')}_${Math.abs(hashCode(`${finding.fingerprint}:${item.path}:${finding.lineNumber}:${now.toISOString().slice(0, 10)}`))}`;
    return {
        id,
        provider: finding.provider,
        repo: item.repo,
        filePath: item.path,
        line: finding.lineNumber,
        confidence: finding.confidence,
        severity: finding.severity,
        fingerprint: finding.fingerprint,
        ruleId: `public-code-search:${finding.ruleId}`,
        redactedContext: finding.contextExcerpt,
        redactedSecret: finding.redactedSecret,
        commitSha: item.sha ?? 'public-code-search',
        commitUrl: item.htmlUrl,
        rotationChecklist: rotationChecklistFor(finding.provider),
        telegramAlert: {
            title: `${finding.severity.toUpperCase()} ${finding.provider} secret found in public GitHub code search`,
            severity: finding.severity,
            repo: item.repo,
            filePath: item.path,
            line: finding.lineNumber,
            text: `${finding.severity.toUpperCase()} public exposure in ${item.repo}:${item.path}:${finding.lineNumber}. Context: ${finding.contextExcerpt}`,
            actions: ['Acknowledge', 'Resolve', 'False positive', 'Open GitHub result', 'Rotation checklist']
        }
    };
}
function fixtureClient(items) {
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
function defaultFixtureItems() {
    return [
        {
            repo: 'demo/public-exposure-fixture',
            path: 'src/leaked-config.ts',
            sha: 'fixture-public-sha',
            htmlUrl: 'https://github.com/demo/public-exposure-fixture/blob/main/src/leaked-config.ts',
            text: "export const OPENAI_API_KEY = 'sk-proj-PublicExposureFixtureSecret1234567890ABCDE';\n"
        },
        {
            repo: 'demo/public-exposure-fixture',
            path: 'README.md',
            text: 'Use sk-proj-example-placeholder-not-a-secret-xxxxxxxxxxxxxxxx in docs only.\n'
        }
    ];
}
function hashCode(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1)
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
    return hash;
}
