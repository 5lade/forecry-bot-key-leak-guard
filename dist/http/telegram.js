import { renderCriticalLeakAlert } from '../renderers/alerts.js';
import { renderRotationChecklist } from '../renderers/rotation.js';
import { routeTelegramCommand, sampleIncidentForTelegram } from '../integrations/telegram/commands.js';
import { getLocalIncident, updateLocalIncidentStatus, upsertLocalIncident } from '../integrations/telegram/store.js';
const ACTION_STATUS = {
    acknowledge: 'acknowledged',
    resolve: 'resolved',
    snooze: 'snoozed',
    false_positive: 'false_positive'
};
export function registerTelegramRoutes(app, config) {
    app.post('/webhooks/telegram', async (request, reply) => {
        if (config.telegramWebhookSecret) {
            const provided = headerValue(request.headers['x-telegram-bot-api-secret-token']);
            if (provided !== config.telegramWebhookSecret)
                return reply.code(401).send({ ok: false, error: 'invalid_telegram_secret' });
        }
        const update = parsedBodyFrom(request.body);
        if (update.callback_query)
            return handleCallback(update.callback_query.data, reply);
        if (update.message?.text)
            return reply.code(200).send({ ok: true, method: 'sendMessage', chat_id: update.message.chat.id, text: routeTelegramCommand(update.message, config) });
        return reply.code(200).send({ ok: true, ignored: true });
    });
    app.get('/telegram/alert-fixture', async () => {
        const incident = sampleIncidentForTelegram();
        upsertLocalIncident(incident);
        return { ok: true, incidentId: incident.id, alert: renderCriticalLeakAlert(incident) };
    });
}
function handleCallback(data, reply) {
    const match = data?.match(/^incident:([a-z_]+):(.+)$/);
    if (!match)
        return reply.code(200).send({ ok: true, ignored: 'unknown_callback' });
    const action = match[1];
    const incidentId = match[2];
    if (!action || !incidentId)
        return reply.code(200).send({ ok: true, ignored: 'malformed_callback' });
    const record = getLocalIncident(incidentId);
    if (!record)
        return reply.code(404).send({ ok: false, error: 'incident_not_found' });
    if (action === 'rotation_checklist')
        return reply.code(200).send({ ok: true, method: 'answerCallbackQuery', text: renderRotationChecklist(record.incident) });
    const status = ACTION_STATUS[action];
    if (!status)
        return reply.code(200).send({ ok: true, ignored: action });
    const updated = updateLocalIncidentStatus(incidentId, status, action ?? status);
    return reply.code(200).send({ ok: true, incidentId, status: updated?.status, method: 'editMessageReplyMarkup' });
}
function headerValue(value) {
    return Array.isArray(value) ? String(value[0]) : typeof value === 'string' ? value : undefined;
}
function parsedBodyFrom(body) {
    if (typeof body === 'string')
        return JSON.parse(body);
    if (body && typeof body === 'object' && '__parsed' in body)
        return body.__parsed;
    return body;
}
