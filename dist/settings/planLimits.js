export const PLAN_LIMITS = {
    trial: { plan: 'trial', repositoryLimit: 1, label: 'Trial' },
    starter: { plan: 'starter', repositoryLimit: 3, label: 'Starter' },
    pro: { plan: 'pro', repositoryLimit: 10, label: 'Pro' },
    agency: { plan: 'agency', repositoryLimit: 100, label: 'Agency' }
};
export function normalizePlan(value) {
    if (typeof value !== 'string')
        return undefined;
    const plan = value.trim().toLowerCase();
    return plan === 'trial' || plan === 'starter' || plan === 'pro' || plan === 'agency' ? plan : undefined;
}
export function repositoryLimitForPlan(plan) {
    return PLAN_LIMITS[plan].repositoryLimit;
}
export function planLimitCopy(input) {
    const limit = PLAN_LIMITS[input.plan];
    const repoWord = limit.repositoryLimit === 1 ? 'repo' : 'repos';
    const blockedWord = input.blocked === 1 ? 'repo was' : 'repos were';
    return `${limit.label} allows ${limit.repositoryLimit} ${repoWord}. ${input.blocked} selected ${blockedWord} not added. Upgrade to Pro or Agency in billing to watch more repositories.`;
}
