import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../config.js';
import type { Plan } from '../domain/types.js';
import { normalizePlan } from '../settings/planLimits.js';

export interface BillingWebhookResult {
  ok: boolean;
  workspaceId?: string;
  plan?: Plan;
  ignored?: string;
  error?: string;
}

export function checkoutPriceId(config: AppConfig, plan: Plan): string | undefined {
  if (plan === 'starter') return config.stripePriceStarter;
  if (plan === 'pro') return config.stripePricePro;
  if (plan === 'agency') return config.stripePriceAgency;
  return undefined;
}

export function fixtureCheckoutUrl(input: { baseUrl?: string; workspaceId: string; plan: Plan }): string {
  const baseUrl = input.baseUrl ?? 'http://localhost:3000';
  return `${baseUrl}/billing/checkout/fixture?workspace_id=${encodeURIComponent(input.workspaceId)}&plan=${input.plan}`;
}

export function fixturePortalUrl(input: { baseUrl?: string; workspaceId: string }): string {
  const baseUrl = input.baseUrl ?? 'http://localhost:3000';
  return `${baseUrl}/billing/portal/fixture?workspace_id=${encodeURIComponent(input.workspaceId)}`;
}

export function verifyStripeSignature(rawBody: string, signature: string | undefined, secret: string | undefined, fixtureMode = false): boolean {
  if (fixtureMode) return true;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(signature.split(',').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts.v1);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function parseStripePlanEvent(event: any): BillingWebhookResult {
  const eventType = String(event?.type ?? '');
  const object = event?.data?.object ?? event;
  const metadata = object?.metadata ?? {};
  const workspaceId = stringValue(metadata.workspace_id ?? metadata.workspaceId ?? object?.client_reference_id);
  const plan = normalizePlan(metadata.plan ?? object?.plan ?? object?.subscription_plan);
  if (!eventType || eventType === '[object Object]') return { ok: false, error: 'invalid_event' };
  if (!['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated'].includes(eventType)) return { ok: true, ignored: eventType };
  if (!workspaceId) return { ok: false, error: 'missing_workspace_id' };
  if (!plan || plan === 'trial') return { ok: false, error: 'missing_paid_plan' };
  return { ok: true, workspaceId, plan };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}
