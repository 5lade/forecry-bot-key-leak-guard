const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
export function generateDailyDigest(input) {
    if (!input.days.length)
        throw new Error('Daily digest requires at least one day');
    const providerSpendDeltas = {};
    let reposScanned = 0;
    let incidentsOpened = 0;
    let incidentsResolved = 0;
    let unresolvedRotationTasks = 0;
    let topRisk;
    for (const day of input.days) {
        reposScanned += assertNonNegativeInteger(day.reposScanned, `${day.date}.reposScanned`);
        incidentsOpened += assertNonNegativeInteger(day.incidentsOpened, `${day.date}.incidentsOpened`);
        incidentsResolved += assertNonNegativeInteger(day.incidentsResolved, `${day.date}.incidentsResolved`);
        unresolvedRotationTasks += assertNonNegativeInteger(day.unresolvedRotationTasks, `${day.date}.unresolvedRotationTasks`);
        for (const [provider, delta] of Object.entries(day.providerSpendDeltas)) {
            const normalizedProvider = provider.trim().toLowerCase();
            if (!normalizedProvider)
                continue;
            providerSpendDeltas[normalizedProvider] = roundMoney((providerSpendDeltas[normalizedProvider] ?? 0) + Number(delta));
        }
        for (const risk of day.risks) {
            if (!topRisk || severityRank[risk.severity] > severityRank[topRisk.severity])
                topRisk = risk;
        }
    }
    return {
        workspaceName: input.workspaceName,
        generatedAt: new Date(input.generatedAt).toISOString(),
        daysCovered: input.days.length,
        repos_scanned: reposScanned,
        incidents_opened: incidentsOpened,
        incidents_resolved: incidentsResolved,
        unresolved_rotation_tasks: unresolvedRotationTasks,
        provider_spend_deltas: sortMoneyMap(providerSpendDeltas),
        top_risk: renderTopRisk(topRisk),
        next_recommended_action: chooseNextAction({ unresolvedRotationTasks, incidentsOpened, incidentsResolved, topRisk })
    };
}
export function renderTelegramDigest(summary) {
    const spend = Object.entries(summary.provider_spend_deltas)
        .map(([provider, delta]) => `${provider}: ${formatMoneyDelta(delta)}`)
        .join(', ') || 'none';
    return [
        `Key Leak Guard daily digest — ${escapeTelegram(summary.workspaceName)}`,
        `generated_at: ${summary.generatedAt}`,
        `days_covered: ${summary.daysCovered}`,
        `repos_scanned: ${summary.repos_scanned}`,
        `incidents_opened: ${summary.incidents_opened}`,
        `incidents_resolved: ${summary.incidents_resolved}`,
        `unresolved_rotation_tasks: ${summary.unresolved_rotation_tasks}`,
        `provider_spend_deltas: ${spend}`,
        `top_risk: ${escapeTelegram(summary.top_risk)}`,
        `next_recommended_action: ${escapeTelegram(summary.next_recommended_action)}`
    ].join('\n');
}
function chooseNextAction(input) {
    if (input.unresolvedRotationTasks > 0)
        return `Finish ${input.unresolvedRotationTasks} unresolved rotation task${input.unresolvedRotationTasks === 1 ? '' : 's'} before deploying new code.`;
    if (input.topRisk?.severity === 'critical')
        return `Investigate critical risk: ${input.topRisk.label}.`;
    if (input.incidentsOpened > input.incidentsResolved)
        return 'Review newly opened incidents and acknowledge owner/action for each one.';
    return 'No urgent leak work; keep scheduled scans and spend checks enabled.';
}
function renderTopRisk(risk) {
    if (!risk)
        return 'none';
    const location = [risk.provider, risk.repo].filter(Boolean).join(' / ');
    return `${risk.severity}: ${risk.label}${location ? ` (${location})` : ''}`;
}
function assertNonNegativeInteger(value, field) {
    if (!Number.isInteger(value) || value < 0)
        throw new Error(`Invalid ${field}: expected non-negative integer`);
    return value;
}
function sortMoneyMap(map) {
    return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([provider, value]) => [provider, roundMoney(value)]));
}
function roundMoney(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(2));
}
function formatMoneyDelta(value) {
    const prefix = value > 0 ? '+' : '';
    return `${prefix}$${value.toFixed(2)}`;
}
function escapeTelegram(value) {
    return value.replace(/[\r\n]+/g, ' ').replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').replace(/\b[A-Za-z0-9_]{24,}\b/g, '[redacted]');
}
