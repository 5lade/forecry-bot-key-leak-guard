import { checkoutPriceId, fixtureCheckoutUrl, fixturePortalUrl, parseStripePlanEvent, verifyStripeSignature } from '../billing/stripe.js';
import { getWorkspace, updateWorkspacePlan } from '../onboarding/localStore.js';
import { normalizePlan, repositoryLimitForPlan } from '../settings/planLimits.js';
import { recordAuditEvent } from '../security/index.js';
export function registerBillingRoutes(app, config) {
    app.post('/billing/checkout', async (request, reply) => {
        const body = parsedBodyFrom(request.body);
        const workspaceId = stringParam(body.workspace_id ?? body.workspaceId);
        const plan = normalizePlan(body.plan);
        if (!workspaceId || !getWorkspace(workspaceId))
            return reply.code(404).send({ ok: false, error: 'workspace_not_found' });
        if (!plan || plan === 'trial')
            return reply.code(400).send({ ok: false, error: 'paid_plan_required' });
        const priceId = checkoutPriceId(config, plan);
        if (!config.stripeSecretKey || !priceId || config.localFixtureMode || config.nodeEnv !== 'production') {
            return reply.send({ ok: true, mode: 'fixture', workspaceId, plan, url: fixtureCheckoutUrl({ baseUrl: config.appBaseUrl, workspaceId, plan }), message: 'Fixture Checkout URL generated. Configure Stripe secrets and price IDs for live Checkout.' });
        }
        return reply.send({ ok: true, mode: 'live_skeleton', workspaceId, plan, priceId, message: 'Stripe Checkout skeleton is configured; wire the Stripe SDK call here in production hardening.' });
    });
    app.get('/billing/portal', async (request, reply) => {
        const workspaceId = stringParam(request.query?.workspace_id ?? request.query?.workspaceId);
        if (!workspaceId || !getWorkspace(workspaceId))
            return reply.code(404).send({ ok: false, error: 'workspace_not_found' });
        return reply.send({ ok: true, workspaceId, url: fixturePortalUrl({ baseUrl: config.appBaseUrl, workspaceId }), message: config.stripeSecretKey ? 'Customer portal skeleton ready; wire Stripe billing portal session creation for live mode.' : 'Fixture customer portal URL generated.' });
    });
    app.post('/billing/stripe/webhook', async (request, reply) => {
        const rawBody = rawBodyFrom(request.body);
        const fixtureMode = config.localFixtureMode || request.headers['x-key-leak-fixture'] === 'true';
        const signature = Array.isArray(request.headers['stripe-signature']) ? request.headers['stripe-signature'][0] : request.headers['stripe-signature'];
        if (!verifyStripeSignature(rawBody, signature, config.stripeWebhookSecret, fixtureMode))
            return reply.code(401).send({ ok: false, error: 'invalid_stripe_signature' });
        const event = parsedBodyFrom(request.body);
        const parsed = parseStripePlanEvent(event);
        if (!parsed.ok)
            return reply.code(400).send(parsed);
        if (parsed.ignored)
            return reply.code(202).send(parsed);
        const snapshot = updateWorkspacePlan(parsed.workspaceId, parsed.plan);
        recordAuditEvent({ actor: 'stripe-webhook', action: 'billing_plan_updated', workspaceId: snapshot.workspace.id, target: snapshot.account.id, metadata: { plan: snapshot.account.plan } });
        return reply.send({ ok: true, workspaceId: snapshot.workspace.id, plan: snapshot.account.plan, repositoryLimit: repositoryLimitForPlan(snapshot.account.plan) });
    });
}
function rawBodyFrom(body) {
    if (typeof body === 'string')
        return body;
    if (body && typeof body === 'object' && '__rawBody' in body)
        return String(body.__rawBody);
    return JSON.stringify(body ?? {});
}
function parsedBodyFrom(body) {
    if (typeof body === 'string')
        return JSON.parse(body);
    if (body && typeof body === 'object' && '__parsed' in body)
        return body.__parsed;
    return body ?? {};
}
function stringParam(value) {
    if (Array.isArray(value))
        return stringParam(value[0]);
    if (typeof value === 'string' && value.trim())
        return value.trim();
    return undefined;
}
