export type MetricLabels = Record<string, string | number | boolean | undefined>;

interface CounterSample {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

const counters = new Map<string, CounterSample>();

export function incrementCounter(name: string, labels: MetricLabels = {}, amount = 1, help = `${name} counter`) {
  const normalized = normalizeLabels(labels);
  const key = `${name}:${JSON.stringify(normalized)}`;
  const current = counters.get(key) ?? { name, help, value: 0, labels: normalized };
  current.value += amount;
  counters.set(key, current);
  return current.value;
}

export function renderPrometheusMetrics(): string {
  const byName = new Map<string, CounterSample[]>();
  for (const sample of counters.values()) byName.set(sample.name, [...(byName.get(sample.name) ?? []), sample]);
  const lines: string[] = [];
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

function normalizeLabels(labels: MetricLabels): Record<string, string> {
  return Object.fromEntries(Object.entries(labels).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined).map(([key, value]) => [key, String(value)]));
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
