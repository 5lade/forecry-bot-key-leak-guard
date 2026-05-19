const DEFAULT_MINIMUM_MULTIPLIER = 3;
const DEFAULT_CORRELATION_WINDOW_HOURS = 24;
export function normalizeSpendSnapshot(snapshot) {
    const hourlySpendUsd = Number(snapshot.hourlySpendUsd);
    const baselineHourlySpendUsd = Number(snapshot.baselineHourlySpendUsd);
    if (!Number.isFinite(hourlySpendUsd) || hourlySpendUsd < 0)
        throw new Error(`Invalid hourlySpendUsd for ${snapshot.id}`);
    if (!Number.isFinite(baselineHourlySpendUsd) || baselineHourlySpendUsd < 0)
        throw new Error(`Invalid baselineHourlySpendUsd for ${snapshot.id}`);
    const capturedAt = new Date(snapshot.capturedAt);
    if (Number.isNaN(capturedAt.getTime()))
        throw new Error(`Invalid capturedAt for ${snapshot.id}`);
    return {
        ...snapshot,
        provider: normalizeProvider(snapshot.provider),
        capturedAt: capturedAt.toISOString(),
        hourlySpendUsd,
        baselineHourlySpendUsd
    };
}
export function correlateSpendWithFindings(input) {
    const minimumMultiplier = input.minimumMultiplier ?? DEFAULT_MINIMUM_MULTIPLIER;
    const windowMs = (input.correlationWindowHours ?? DEFAULT_CORRELATION_WINDOW_HOURS) * 60 * 60 * 1000;
    const findings = input.recentFindings.map((finding) => ({ ...finding, provider: normalizeProvider(finding.provider) }));
    const anomalies = input.snapshots
        .map(normalizeSpendSnapshot)
        .map((snapshot) => buildAnomaly(snapshot, findings, minimumMultiplier, windowMs))
        .filter((anomaly) => anomaly !== undefined)
        .sort((a, b) => b.multiplier - a.multiplier || a.provider.localeCompare(b.provider));
    return { anomalies };
}
function buildAnomaly(snapshot, findings, minimumMultiplier, windowMs) {
    const multiplier = calculateMultiplier(snapshot.hourlySpendUsd, snapshot.baselineHourlySpendUsd);
    if (multiplier < minimumMultiplier)
        return undefined;
    const linkedFinding = findCorrelatedFinding(snapshot, findings, windowMs);
    return {
        id: `spend_${snapshot.id}`,
        provider: snapshot.provider,
        capturedAt: snapshot.capturedAt,
        hourlySpendUsd: roundMoney(snapshot.hourlySpendUsd),
        baselineHourlySpendUsd: roundMoney(snapshot.baselineHourlySpendUsd),
        multiplier,
        severity: linkedFinding ? 'critical' : severityFromMultiplier(multiplier),
        linkedIncident: Boolean(linkedFinding),
        linkedFindingId: linkedFinding?.id,
        reason: linkedFinding
            ? `>=${minimumMultiplier}x ${snapshot.provider} spend jump after finding ${linkedFinding.id}`
            : `>=${minimumMultiplier}x ${snapshot.provider} spend jump without a recent matching leak finding`
    };
}
function findCorrelatedFinding(snapshot, findings, windowMs) {
    const capturedAtMs = Date.parse(snapshot.capturedAt);
    return findings
        .filter((finding) => finding.provider === snapshot.provider)
        .filter((finding) => {
        const detectedAtMs = Date.parse(finding.detectedAt);
        return Number.isFinite(detectedAtMs) && detectedAtMs <= capturedAtMs && capturedAtMs - detectedAtMs <= windowMs;
    })
        .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt))[0];
}
function calculateMultiplier(current, baseline) {
    if (baseline === 0)
        return current > 0 ? Number.POSITIVE_INFINITY : 0;
    return Number((current / baseline).toFixed(2));
}
function severityFromMultiplier(multiplier) {
    if (multiplier >= 10)
        return 'high';
    if (multiplier >= 5)
        return 'medium';
    return 'low';
}
function normalizeProvider(provider) {
    return provider.trim().toLowerCase();
}
function roundMoney(value) {
    return Number(value.toFixed(2));
}
