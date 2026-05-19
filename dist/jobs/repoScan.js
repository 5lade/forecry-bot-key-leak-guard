import { fixtureRepoSources, scanRepositorySource, sourceForRepo } from '../scanner/repoScan.js';
import { upsertLocalIncident } from '../integrations/telegram/store.js';
export function runManualRepoScan(input) {
    const started = Date.now();
    const target = input.target.trim() || 'all';
    const enabledRepos = input.repositories.filter((repo) => repo.scanEnabled !== false);
    if (!enabledRepos.length)
        return { ok: false, error: 'no_repositories', message: 'No connected repositories are available to scan. Install the GitHub App or use local fixture mode first.' };
    const selected = target.toLowerCase() === 'all'
        ? enabledRepos
        : enabledRepos.filter((repo) => repo.fullName.toLowerCase() === target.toLowerCase() || repo.fullName.split('/').pop()?.toLowerCase() === target.toLowerCase());
    if (!selected.length) {
        return { ok: false, error: 'unknown_repo', message: `Unknown repo "${target}". Try /status to see connected repos, or /scan all.` };
    }
    const sources = fixtureRepoSources();
    const results = [];
    for (const repo of selected) {
        const source = sourceForRepo(repo.fullName, sources);
        if (!source)
            continue;
        const result = scanRepositorySource(source, { hmacSecret: input.hmacSecret });
        for (const incident of result.incidents)
            upsertLocalIncident(incident);
        results.push(result);
    }
    if (!results.length) {
        const names = selected.map((repo) => repo.fullName).join(', ');
        return { ok: false, error: 'unknown_repo', message: `No local fixture content is available for ${names}. Fixture scans currently support demo/key-leak-guard-fixture.` };
    }
    const findingsBySeverity = results.reduce((counts, result) => {
        counts.low += result.findingsBySeverity.low;
        counts.medium += result.findingsBySeverity.medium;
        counts.high += result.findingsBySeverity.high;
        counts.critical += result.findingsBySeverity.critical;
        return counts;
    }, { low: 0, medium: 0, high: 0, critical: 0 });
    return {
        ok: true,
        requestedTarget: target,
        results,
        scannedFileCount: results.reduce((sum, result) => sum + result.scannedFiles, 0),
        findingsBySeverity,
        incidentLinks: results.flatMap((result) => result.incidentLinks),
        checkpoints: results.map((result) => result.checkpoint),
        durationMs: Date.now() - started
    };
}
