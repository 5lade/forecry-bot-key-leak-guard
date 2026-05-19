import { createHmac, timingSafeEqual } from 'node:crypto';
import { purgeWorkspace, snapshotForWorkspace } from '../onboarding/localStore.js';
import { listLocalIncidents } from '../integrations/telegram/store.js';
import { rotationRunbookFor, SUPPORTED_ROTATION_PROVIDERS } from '../runbooks/rotation.js';
import { listAuditEvents, recordAuditEvent } from '../security/index.js';
const ADMIN_COOKIE = 'klg_admin_session';
export function registerAdminRoutes(app, config) {
    app.delete('/admin/workspaces/:workspaceId', async (request, reply) => {
        const workspaceId = stringParam(request.params?.workspaceId);
        if (!workspaceId)
            return reply.code(400).send({ ok: false, error: 'missing_workspace_id' });
        const token = stringParam(request.query?.token) ?? tokenFromCookie(request.headers?.cookie);
        if (!isValidAdminToken(config, workspaceId, token))
            return reply.code(401).send({ ok: false, error: 'admin_token_required' });
        const result = purgeWorkspace(workspaceId);
        recordAuditEvent({ actor: 'admin', action: 'workspace_purged', workspaceId, target: workspaceId, metadata: result });
        return reply.code(result.workspaceDeleted ? 200 : 404).send({ ok: result.workspaceDeleted, ...result });
    });
    app.get('/admin/audit', async (request, reply) => {
        const workspaceId = stringParam(request.query?.workspace_id);
        if (!workspaceId)
            return reply.code(400).send({ ok: false, error: 'missing_workspace_id' });
        const token = stringParam(request.query?.token) ?? tokenFromCookie(request.headers?.cookie);
        if (!isValidAdminToken(config, workspaceId, token))
            return reply.code(401).send({ ok: false, error: 'admin_token_required' });
        return reply.send({ ok: true, events: listAuditEvents(workspaceId) });
    });
    app.get('/admin', async (request, reply) => {
        const workspaceId = stringParam(request.query?.workspace_id);
        if (!workspaceId)
            return reply.code(400).type('text/html; charset=utf-8').send(page('Missing workspace', '<p>Missing <code>workspace_id</code>.</p>'));
        const token = stringParam(request.query?.token) ?? tokenFromCookie(request.headers?.cookie);
        if (!isValidAdminToken(config, workspaceId, token)) {
            return reply.code(401).type('text/html; charset=utf-8').send(page('Admin login required', '<p>Admin access requires a signed setup/session token from the onboarding flow.</p>'));
        }
        const snapshot = snapshotForWorkspace(workspaceId);
        if (!snapshot)
            return reply.code(404).type('text/html; charset=utf-8').send(page('Workspace not found', '<p>Workspace not found. Send <code>/start</code> in Telegram first.</p>'));
        reply.header('set-cookie', `${ADMIN_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=86400`);
        return reply.type('text/html; charset=utf-8').send(renderAdminPage(config, snapshot));
    });
}
export function createAdminToken(config, workspaceId) {
    return createHmac('sha256', adminSecret(config)).update(`admin:v1:${workspaceId}`).digest('base64url');
}
function isValidAdminToken(config, workspaceId, token) {
    if (!token)
        return false;
    const expected = createAdminToken(config, workspaceId);
    const expectedBuffer = Buffer.from(expected);
    const tokenBuffer = Buffer.from(token);
    return expectedBuffer.length === tokenBuffer.length && timingSafeEqual(expectedBuffer, tokenBuffer);
}
function renderAdminPage(config, snapshot) {
    const repoRows = snapshot.repositories.length
        ? snapshot.repositories.map((repo) => `<tr><td>${escapeHtml(repo.fullName)}</td><td>${escapeHtml(repo.defaultBranch)}</td><td>${repo.private ? 'private' : 'public'}</td><td>${repo.scanEnabled ? 'enabled' : 'paused'}</td></tr>`).join('')
        : '<tr><td colspan="4">No repositories connected yet.</td></tr>';
    const incidents = listLocalIncidents().slice(0, 25);
    const incidentRows = incidents.length
        ? incidents.map((record) => `<tr><td>${escapeHtml(record.incident.id)}</td><td>${escapeHtml(record.incident.severity)}</td><td>${escapeHtml(record.status)}</td><td>${escapeHtml(record.incident.provider)}</td><td>${escapeHtml(record.incident.repo)}</td><td>${escapeHtml(record.incident.filePath)}:${escapeHtml(String(record.incident.line))}</td><td>${escapeHtml(record.updatedAt)}</td></tr>`).join('')
        : '<tr><td colspan="7">No incidents recorded.</td></tr>';
    const providerRunbooks = SUPPORTED_ROTATION_PROVIDERS.map((provider) => rotationRunbookFor(provider));
    const spendRows = providerRunbooks.map((runbook) => `<tr><td>${escapeHtml(runbook.displayName)}</td><td>${config.localFixtureMode ? 'mock/manual' : 'not connected'}</td><td><a href="${escapeAttribute(runbook.consoleUrl)}">console</a> · <a href="${escapeAttribute(runbook.docsUrl)}">docs</a></td></tr>`).join('');
    const billingLinks = providerRunbooks.map((runbook) => `<li><a href="${escapeAttribute(runbook.consoleUrl)}">${escapeHtml(runbook.displayName)} billing/keys</a></li>`).join('');
    return page('Key Leak Guard Admin', `
    <section><h2>Workspace</h2><p><strong>${escapeHtml(snapshot.workspace.name)}</strong> (${escapeHtml(snapshot.workspace.id)}) · plan ${escapeHtml(snapshot.account.plan)}</p><p><a href="/github/install?workspace_id=${encodeURIComponent(snapshot.workspace.id)}">GitHub setup/status</a> · <a href="/ready">readiness</a> · <a href="/metrics">metrics</a></p></section>
    <section><h2>Repositories</h2><table><thead><tr><th>Repo</th><th>Default branch</th><th>Visibility</th><th>Scanning</th></tr></thead><tbody>${repoRows}</tbody></table></section>
    <section><h2>Incident history</h2><p class="muted">Secret values are never shown here; only provider, repo, path, and status metadata.</p><table><thead><tr><th>ID</th><th>Severity</th><th>Status</th><th>Provider</th><th>Repo</th><th>Location</th><th>Updated</th></tr></thead><tbody>${incidentRows}</tbody></table></section>
    <section><h2>Data controls</h2><p class="muted">Workspace deletion purges local workspace, installation, repository, credential, and incident metadata. Use signed admin API <code>DELETE /admin/workspaces/${escapeHtml(snapshot.workspace.id)}</code>.</p></section>
    <section><h2>Provider spend sources</h2><table><thead><tr><th>Provider</th><th>Status</th><th>Setup links</th></tr></thead><tbody>${spendRows}</tbody></table></section>
    <section><h2>Billing setup links</h2><ul>${billingLinks}</ul></section>
  `);
}
function page(title, body) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:2rem;line-height:1.4;color:#172033}table{border-collapse:collapse;width:100%;margin:1rem 0}th,td{border:1px solid #d8dee9;padding:.45rem;text-align:left;vertical-align:top}th{background:#f5f7fb}.muted{color:#596579}section{margin-bottom:2rem}code{background:#f5f7fb;padding:.1rem .25rem}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}
function adminSecret(config) {
    if (config.hmacSecret)
        return config.hmacSecret;
    if (config.nodeEnv === 'production')
        throw new Error('HMAC_SECRET required for admin tokens');
    return 'local-fixture-admin-secret';
}
function tokenFromCookie(cookieHeader) {
    if (!cookieHeader)
        return undefined;
    for (const part of cookieHeader.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === ADMIN_COOKIE)
            return decodeURIComponent(rest.join('='));
    }
    return undefined;
}
function stringParam(value) {
    if (Array.isArray(value))
        return stringParam(value[0]);
    if (typeof value === 'string' && value.trim())
        return value.trim();
    return undefined;
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}
