import { recordGitHubInstallation } from '../../onboarding/localStore.js';
export function githubSetupUrl(config, workspaceId) {
    const baseUrl = config.appBaseUrl ?? 'http://localhost:3000';
    const appIdOrSlug = config.githubAppId ?? 'fixture-app';
    return `${baseUrl}/oauth/github/callback?workspace_id=${encodeURIComponent(workspaceId)}&installation_id=424242&setup_action=install&repositories=demo/key-leak-guard-fixture`;
}
export function githubCredentialStatus(config) {
    const missing = [];
    if (!config.githubAppId)
        missing.push('GITHUB_APP_ID');
    if (!config.githubAppPrivateKey)
        missing.push('GITHUB_APP_PRIVATE_KEY');
    if (!config.appBaseUrl)
        missing.push('APP_BASE_URL');
    if (!missing.length || config.localFixtureMode || config.nodeEnv !== 'production')
        return { ok: true, missing };
    return { ok: false, missing, message: `GitHub App setup is not configured. Set ${missing.join(', ')} or enable LOCAL_FIXTURE_MODE=true for local testing.` };
}
export function syncFixtureInstallation(input) {
    return recordGitHubInstallation({
        workspaceId: input.workspaceId,
        installationId: input.installationId ?? 424242,
        accountLogin: 'fixture-owner',
        setupAction: 'install',
        repositories: input.repositories?.length ? input.repositories : [{ id: 424242, fullName: 'demo/key-leak-guard-fixture', defaultBranch: 'main', private: true }]
    });
}
