const counters = new Map();
export function incrementCounter(name, labels = {}, amount = 1, help = `${name} counter`) {
    const normalized = normalizeLabels(labels);
    const key = `${name}:${JSON.stringify(normalized)}`;
    const current = counters.get(key) ?? { name, help, value: 0, labels: normalized };
    current.value += amount;
    counters.set(key, current);
    return current.value;
}
export function renderPrometheusMetrics() {
    const byName = new Map();
    for (const sample of counters.values())
        byName.set(sample.name, [...(byName.get(sample.name) ?? []), sample]);
    const lines = [];
    for (const [name, samples] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`# HELP ${name} ${samples[0]?.help ?? `${name} counter`}`);
        lines.push(`# TYPE ${name} counter`);
        for (const sample of samples.sort((a, b) => JSON.stringify(a.labels).localeCompare(JSON.stringify(b.labels)))) {
            const labels = Object.entries(sample.labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',');
            lines.push(`${name}${labels ? `{${labels}}` : ''} ${sample.value}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
export function snapshotCounters() {
    return [...counters.values()].map((sample) => ({ ...sample, labels: { ...sample.labels } }));
}
export function resetMetricsForTests() {
    counters.clear();
}
function normalizeLabels(labels) {
    return Object.fromEntries(Object.entries(labels).filter((entry) => entry[1] !== undefined).map(([key, value]) => [key, String(value)]));
}
function escapeLabel(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
