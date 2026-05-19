const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const DEFAULT_POLICY = {
    severityThreshold: 'high',
    digestTimeUtc: '09:00',
    reminderCadenceMinutes: 30,
    repoScanEnabled: {},
    spendAnomalyMultipliers: {}
};
const policies = new Map();
export function getAlertPolicy(workspaceId) {
    const existing = policies.get(workspaceId);
    if (existing)
        return clonePolicy(existing);
    const created = { workspaceId, ...DEFAULT_POLICY, updatedAt: new Date(0).toISOString() };
    policies.set(workspaceId, created);
    return clonePolicy(created);
}
export function updateAlertPolicy(workspaceId, update, now = new Date()) {
    const current = getAlertPolicy(workspaceId);
    const next = {
        ...current,
        repoScanEnabled: { ...current.repoScanEnabled },
        spendAnomalyMultipliers: { ...current.spendAnomalyMultipliers },
        updatedAt: now.toISOString()
    };
    if (update.severityThreshold !== undefined)
        next.severityThreshold = parseSeverity(update.severityThreshold);
    if (update.digestTimeUtc !== undefined)
        next.digestTimeUtc = parseDigestTime(update.digestTimeUtc);
    if (update.reminderCadenceMinutes !== undefined)
        next.reminderCadenceMinutes = parseReminderCadence(update.reminderCadenceMinutes);
    if (update.repo)
        next.repoScanEnabled[normalizeRepo(update.repo.fullName)] = update.repo.enabled;
    if (update.spendAnomaly)
        next.spendAnomalyMultipliers[normalizeProvider(update.spendAnomaly.provider)] = parseSpendMultiplier(update.spendAnomaly.multiplier);
    policies.set(workspaceId, next);
    return clonePolicy(next);
}
export function shouldAlertForSeverity(workspaceId, severity) {
    const policy = getAlertPolicy(workspaceId);
    return SEVERITY_RANK[severity] >= SEVERITY_RANK[policy.severityThreshold];
}
export function isRepoScanEnabled(workspaceId, repoFullName) {
    const policy = getAlertPolicy(workspaceId);
    return policy.repoScanEnabled[normalizeRepo(repoFullName)] ?? true;
}
export function spendAnomalyThresholdFor(workspaceId, provider) {
    const policy = getAlertPolicy(workspaceId);
    return policy.spendAnomalyMultipliers[normalizeProvider(provider)] ?? 3;
}
export function shouldSendDigestAt(workspaceId, hhmmUtc) {
    return getAlertPolicy(workspaceId).digestTimeUtc === parseDigestTime(hhmmUtc);
}
export function resetAlertPolicies() {
    policies.clear();
}
export function parseSeverity(value) {
    const normalized = value.trim().toLowerCase();
    if (!VALID_SEVERITIES.includes(normalized))
        throw new Error('invalid severity threshold: use low, medium, high, or critical');
    return normalized;
}
export function parseDigestTime(value) {
    const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match)
        throw new Error('invalid digest time: use HH:MM in UTC, for example 09:00');
    return `${match[1].padStart(2, '0')}:${match[2]}`;
}
export function parseReminderCadence(value) {
    const text = String(value).trim().toLowerCase();
    const match = text.match(/^(\d+)(?:m|min|mins|minutes)?$/);
    const minutes = match ? Number(match[1]) : Number.NaN;
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240)
        throw new Error('invalid reminder cadence: use 5-240 minutes, for example 30m');
    return minutes;
}
export function parseSpendMultiplier(value) {
    const multiplier = Number(String(value).trim().replace(/x$/i, ''));
    if (!Number.isFinite(multiplier) || multiplier < 1.5 || multiplier > 100)
        throw new Error('invalid spend threshold: use a multiplier from 1.5x to 100x');
    return Number(multiplier.toFixed(2));
}
function clonePolicy(policy) {
    return {
        ...policy,
        repoScanEnabled: { ...policy.repoScanEnabled },
        spendAnomalyMultipliers: { ...policy.spendAnomalyMultipliers }
    };
}
function normalizeRepo(value) {
    const repo = value.trim().toLowerCase();
    if (!repo || !repo.includes('/'))
        throw new Error('invalid repo: use owner/name');
    return repo;
}
function normalizeProvider(value) {
    const provider = value.trim().toLowerCase();
    if (!provider)
        throw new Error('invalid provider: provide a provider name like openai');
    return provider;
}
