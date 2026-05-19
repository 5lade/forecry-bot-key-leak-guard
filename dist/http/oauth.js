import { githubCredentialStatus, githubSetupUrl, syncFixtureInstallation } from '../integrations/github/app.js';
import { getWorkspace } from '../onboarding/localStore.js';
export function registerOAuthRoutes(app, config) {
    app.get('/github/install', async (request, reply) => {
        const workspaceId = stringParam(request.query?.workspace_id ?? request.query?.state);
        if (!workspaceId || !getWorkspace(workspaceId))
            return reply.code(404).send({ ok: false, error: 'workspace_not_found', hint: 'Send /start in Telegram first, then open the setup link again.' });
        const credentials = githubCredentialStatus(config);
        return {
            ok: credentials.ok,
            workspaceId,
            setupUrl: githubSetupUrl(config, workspaceId),
            fixtureMode: config.localFixtureMode || config.nodeEnv !== 'production',
            missing: credentials.missing,
            message: credentials.message ?? 'Install the GitHub App, then return through the callback URL with installation_id and selected repositories.'
        };
    });
    app.get('/oauth/github/callback', async (request, reply) => handleCallback(request.query ?? {}, reply));
    app.post('/oauth/github/callback', async (request, reply) => handleCallback(parsedBodyFrom(request.body), reply));
    function handleCallback(input, reply) {
        const workspaceId = stringParam(input.workspace_id ?? input.state);
        if (!workspaceId || !getWorkspace(workspaceId))
            return reply.code(404).send({ ok: false, error: 'workspace_not_found', hint: 'Send /start in Telegram before installing the GitHub App.' });
        const installationId = stringParam(input.installation_id) ?? '424242';
        const repositories = parseRepositories(input.repositories ?? input.repository ?? input.repo);
        const snapshot = syncFixtureInstallation({ workspaceId, installationId, repositories });
        return reply.code(200).send({
            ok: true,
            workspaceId,
            installationId,
            connectedRepositories: snapshot.repositories.length,
            repositories: snapshot.repositories.map((repo) => repo.fullName),
            message: `Connected ${snapshot.repositories.length} GitHub repos. Return to Telegram and send /status.`
        });
    }
}
function stringParam(value) {
    if (Array.isArray(value))
        return stringParam(value[0]);
    if (typeof value === 'string' && value.trim())
        return value.trim();
    if (typeof value === 'number' || typeof value === 'bigint')
        return String(value);
    return undefined;
}
function parseRepositories(value) {
    if (!value)
        return undefined;
    if (Array.isArray(value))
        return value.flatMap((item) => parseRepositories(item) ?? []);
    if (typeof value === 'string') {
        return value.split(',').map((fullName) => fullName.trim()).filter(Boolean).map((fullName) => ({ fullName }));
    }
    if (typeof value === 'object') {
        const maybe = value;
        const fullName = maybe.fullName ?? maybe.full_name;
        return fullName ? [{ id: maybe.id, fullName, defaultBranch: maybe.defaultBranch ?? maybe.default_branch, private: maybe.private }] : undefined;
    }
    return undefined;
}
function parsedBodyFrom(body) {
    if (typeof body === 'string')
        return JSON.parse(body);
    if (body && typeof body === 'object' && '__parsed' in body)
        return body.__parsed;
    return body ?? {};
}
