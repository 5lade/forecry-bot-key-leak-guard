import type { AppConfig } from '../config.js';
import { renderCriticalLeakAlert } from '../renderers/alerts.js';
import { renderRotationChecklist } from '../renderers/rotation.js';
import { routeTelegramCommand, sampleIncidentForTelegram, type TelegramUpdate } from '../integrations/telegram/commands.js';
import { getLocalIncident, updateLocalIncidentStatus, upsertLocalIncident } from '../integrations/telegram/store.js';
import type { IncidentStatus } from '../domain/types.js';
import { recordAuditEvent, safeEqualSecret, checkRateLimit } from '../security/index.js';

const ACTION_STATUS: Record<string, IncidentStatus> = {
  acknowledge: 'acknowledged',
  resolve: 'resolved',
  snooze: 'snoozed',
  false_positive: 'false_positive'
};

export function registerTelegramRoutes(app: any, config: AppConfig) {
  app.post('/webhooks/telegram', async (request: any, reply: any) => {
    const rate = checkRateLimit({ key: `telegram:${request.ip}`, limit: config.webhookRateLimitPerMinute, windowMs: 60_000 });
    if (!rate.allowed) return reply.code(429).header('retry-after', Math.ceil((rate.resetAt - Date.now()) / 1000)).send({ ok: false, error: 'rate_limited' });

    if (config.telegramWebhookSecret) {
      const provided = headerValue(request.headers['x-telegram-bot-api-secret-token']);
      if (!safeEqualSecret(provided, config.telegramWebhookSecret)) {
        recordAuditEvent({ actor: 'telegram-webhook', action: 'webhook_secret_rejected', metadata: { ip: request.ip } });
        return reply.code(401).send({ ok: false, error: 'invalid_telegram_secret' });
      }
    }

    const update = parsedBodyFrom(request.body) as TelegramUpdate;
    if (update.callback_query) return handleCallback(update.callback_query.data, reply);
    if (update.message?.text) return reply.code(200).send({ ok: true, method: 'sendMessage', chat_id: update.message.chat.id, text: routeTelegramCommand(update.message, config) });
    return reply.code(200).send({ ok: true, ignored: true });
  });

  app.get('/telegram/alert-fixture', async () => {
    const incident = sampleIncidentForTelegram();
    upsertLocalIncident(incident);
    return { ok: true, incidentId: incident.id, alert: renderCriticalLeakAlert(incident) };
  });
}

function handleCallback(data: string | undefined, reply: any) {
  const match = data?.match(/^incident:([a-z_]+):(.+)$/);
  if (!match) return reply.code(200).send({ ok: true, ignored: 'unknown_callback' });
  const action = match[1];
  const incidentId = match[2];
  if (!action || !incidentId) return reply.code(200).send({ ok: true, ignored: 'malformed_callback' });
  const record = getLocalIncident(incidentId);
  if (!record) return reply.code(404).send({ ok: false, error: 'incident_not_found' });
  if (action === 'rotation_checklist') return reply.code(200).send({ ok: true, method: 'answerCallbackQuery', text: renderRotationChecklist(record.incident) });
  const status = ACTION_STATUS[action];
  if (!status) return reply.code(200).send({ ok: true, ignored: action });
  const updated = updateLocalIncidentStatus(incidentId, status, action ?? status);
  recordAuditEvent({ actor: 'telegram-callback', action: `incident_${status}`, target: incidentId, metadata: { action } });
  return reply.code(200).send({ ok: true, incidentId, status: updated?.status, method: 'editMessageReplyMarkup' });
}

function headerValue(value: unknown): string | undefined {
  return Array.isArray(value) ? String(value[0]) : typeof value === 'string' ? value : undefined;
}

function parsedBodyFrom(body: unknown): unknown {
  if (typeof body === 'string') return JSON.parse(body);
  if (body && typeof body === 'object' && '__parsed' in body) return (body as { __parsed: unknown }).__parsed;
  return body;
}
