import { renderPrometheusMetrics } from '../observability/metrics.js';
import { deadLetterSnapshot } from '../observability/retry.js';
import { activeJobLocks } from '../observability/jobQueue.js';
export function registerMetricsRoutes(app) {
    app.get('/metrics', async (_request, reply) => reply.type('text/plain; version=0.0.4').send(renderPrometheusMetrics()));
    app.get('/dead-letters', async () => ({ ok: true, deadLetters: deadLetterSnapshot(), activeJobLocks: activeJobLocks() }));
}
