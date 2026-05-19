import { incrementCounter } from './metrics.js';
const activeLocks = new Set();
export async function withJobLock(jobName, run) {
    if (activeLocks.has(jobName)) {
        incrementCounter('job_lock_total', { job: jobName, status: 'busy' });
        throw new Error(`job_locked:${jobName}`);
    }
    activeLocks.add(jobName);
    incrementCounter('job_lock_total', { job: jobName, status: 'acquired' });
    try {
        const result = await run();
        incrementCounter('job_run_total', { job: jobName, status: 'success' });
        return result;
    }
    catch (error) {
        incrementCounter('job_run_total', { job: jobName, status: 'failure' });
        throw error;
    }
    finally {
        activeLocks.delete(jobName);
    }
}
export function activeJobLocks() {
    return [...activeLocks];
}
