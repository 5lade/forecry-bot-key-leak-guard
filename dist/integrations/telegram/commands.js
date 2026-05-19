import { listLocalIncidents } from './store.js';
export function routeTelegramCommand(message) {
    const command = (message.text ?? '').trim().split(/\s+/)[0]?.split('@')[0]?.toLowerCase() || '/status';
    switch (command) {
        case '/start':
            return 'Key Leak Guard is ready. Connect a GitHub repo, then I will alert you here when a secret is pushed.';
        case '/status':
            return `Key Leak Guard local mode is online. Open incidents: ${listLocalIncidents().filter((record) => record.status === 'open').length}.`;
        case '/incidents': {
            const open = listLocalIncidents().filter((record) => record.status !== 'resolved' && record.status !== 'false_positive');
            if (!open.length)
                return 'No active incidents in local persistence.';
            return open.map((record) => `${record.incident.id}: ${record.incident.severity} ${record.incident.provider} in ${record.incident.repo}:${record.incident.filePath}:${record.incident.line} (${record.status})`).join('\n');
        }
        case '/scan':
            return 'Manual scan stub: repo scan scheduling will run in the next core-feature ticket. For now, use the GitHub webhook fixture or /status.';
        case '/digest':
            return `Digest stub: ${listLocalIncidents().length} total incident(s) tracked locally.`;
        case '/settings':
            return 'Settings stub: alerts are enabled for critical/high leaks; snooze defaults to 24h in local mode.';
        default:
            return 'Unknown command. Try /status, /incidents, /scan, /digest, or /settings.';
    }
}
export function sampleIncidentForTelegram() {
    return {
        id: 'inc_local_fixture_telegram',
        provider: 'openai',
        repo: 'demo/key-leak-guard-fixture',
        filePath: 'src/config.ts',
        line: 2,
        confidence: 0.97,
        severity: 'critical',
        fingerprint: 'hmac_sha256:openai:fixture',
        ruleId: 'openai-api-key',
        redactedContext: 'OPENAI_API_KEY="sk-proj…BCDE"',
        redactedSecret: 'sk-proj…BCDE',
        commitSha: 'abc123def456',
        commitUrl: 'https://github.com/demo/key-leak-guard-fixture/commit/abc123def456',
        rotationChecklist: ['Revoke the exposed OpenAI key', 'Create a replacement key', 'Move it to a secret store', 'Audit recent usage'],
        telegramAlert: {
            title: 'CRITICAL openai secret detected',
            severity: 'critical',
            repo: 'demo/key-leak-guard-fixture',
            filePath: 'src/config.ts',
            line: 2,
            text: 'CRITICAL openai credential detected in demo/key-leak-guard-fixture',
            actions: ['Acknowledge', 'Resolve', 'Snooze', 'False positive', 'Open GitHub commit', 'Rotation checklist']
        }
    };
}
