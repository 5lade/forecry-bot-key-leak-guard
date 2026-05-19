export function dueCriticalIncidentReminders(records, now = new Date()) {
    const nowMs = now.getTime();
    const jobs = records
        .filter((record) => record.status === 'open' || record.status === 'acknowledged')
        .flatMap((record) => record.reminders);
    return {
        due: jobs.filter((job) => job.status === 'scheduled' && new Date(job.runAt).getTime() <= nowMs),
        pending: jobs.filter((job) => job.status === 'scheduled' && new Date(job.runAt).getTime() > nowMs)
    };
}
export function renderReminderJob(job) {
    return `Reminder ${job.id}: critical incident ${job.incidentId} still needs rotation/resolution.`;
}
