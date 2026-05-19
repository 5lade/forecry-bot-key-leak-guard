import { scanText } from './scanner.js';
import { rotationChecklistFor } from '../runbooks/rotation.js';
const DEFAULT_HMAC_SECRET = 'local-fixture-hmac-secret-32-bytes';
const ZERO_SEVERITIES = { low: 0, medium: 0, high: 0, critical: 0 };
const FIXTURE_SOURCES = [
    {
        repo: 'demo/key-leak-guard-fixture',
        defaultBranch: 'main',
        files: [
            {
                path: 'src/config.ts',
                sha: 'fixture-config-sha',
                url: 'https://github.com/demo/key-leak-guard-fixture/blob/main/src/config.ts',
                content: "// production config accidentally committed\nexport const OPENAI_API_KEY = 'sk-proj-KeyLeakManualScanFixtureSecret1234567890ABCDE';\nexport const REGION = 'us-east-1';\n"
            },
            {
                path: 'README.md',
                sha: 'fixture-readme-sha',
                content: 'Use environment variables for credentials. Example placeholders are safe and should not alert.\n'
            },
            {
                path: 'src/safe.ts',
                sha: 'fixture-safe-sha',
                content: "export const SAMPLE_TOKEN = 'example-placeholder-not-a-secret-xxxxxxxxxxxxxxxxxxxxxxxx';\n"
            }
        ]
    }
];
export function fixtureRepoSources() {
    return FIXTURE_SOURCES.map((source) => ({ ...source, files: source.files.map((file) => ({ ...file })) }));
}
export function sourceForRepo(repo, sources = FIXTURE_SOURCES) {
    return sources.find((source) => source.repo.toLowerCase() === repo.toLowerCase());
}
export function scanRepositorySource(source, options = {}) {
    const started = Date.now();
    const hmacSecret = options.hmacSecret ?? process.env.HMAC_SECRET ?? DEFAULT_HMAC_SECRET;
    const findings = [];
    const commitSha = `manual-scan-${source.defaultBranch ?? 'main'}`;
    for (const file of source.files) {
        const summary = scanText({ content: file.content, filePath: file.path, hmacSecret });
        const preferred = summary.findings.filter((finding) => {
            if (finding.provider !== 'generic')
                return true;
            return !summary.findings.some((other) => other.provider !== 'generic' && other.lineNumber === finding.lineNumber && other.redactedSecret === finding.redactedSecret);
        });
        for (const finding of preferred) {
            findings.push({
                provider: finding.provider,
                repo: source.repo,
                filePath: file.path,
                line: finding.lineNumber,
                confidence: finding.confidence,
                severity: finding.severity,
                fingerprint: finding.fingerprint,
                ruleId: finding.ruleId,
                redactedContext: finding.contextExcerpt,
                redactedSecret: finding.redactedSecret,
                commitSha,
                commitUrl: file.url
            });
        }
    }
    const incidents = findings
        .filter((finding) => finding.severity === 'critical' || finding.confidence >= 0.9)
        .map((finding) => manualFindingToIncident(finding));
    const findingsBySeverity = findings.reduce((counts, finding) => {
        counts[finding.severity] += 1;
        return counts;
    }, { ...ZERO_SEVERITIES });
    const now = (options.now ?? new Date()).toISOString();
    return {
        ok: true,
        repo: source.repo,
        scannedFiles: source.files.length,
        findingsBySeverity,
        findings,
        incidents,
        incidentLinks: incidents.map((incident) => incident.id),
        durationMs: Date.now() - started,
        checkpoint: { repo: source.repo, scannedFiles: source.files.length, totalFiles: source.files.length, findings: findings.length, updatedAt: now, status: 'completed' }
    };
}
function manualFindingToIncident(finding) {
    const id = `inc_manual_${finding.repo.replace(/[^A-Za-z0-9]+/g, '_')}_${Math.abs(hashCode(`${finding.fingerprint}:${finding.filePath}:${finding.line}`))}`;
    return {
        id,
        ...finding,
        rotationChecklist: rotationChecklistFor(finding.provider),
        telegramAlert: {
            title: `${finding.severity.toUpperCase()} ${finding.provider} secret detected by manual scan`,
            severity: finding.severity,
            repo: finding.repo,
            filePath: finding.filePath,
            line: finding.line,
            text: `${finding.severity.toUpperCase()} ${finding.provider} credential in ${finding.repo}:${finding.filePath}:${finding.line}. Context: ${finding.redactedContext}`,
            actions: ['Acknowledge', 'Resolve', 'False positive', 'Open GitHub commit', 'Rotation checklist']
        }
    };
}
function hashCode(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1)
        hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
    return hash;
}
