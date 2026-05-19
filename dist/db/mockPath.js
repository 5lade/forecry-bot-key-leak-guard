export function createDemoRecordPath() {
    const account = {
        id: 'acct_demo',
        telegramUserId: 123456789n,
        telegramChatId: 987654321n,
        displayName: 'Demo Founder',
        plan: 'trial'
    };
    const workspace = {
        id: 'wksp_demo',
        accountId: account.id,
        name: 'Demo Workspace'
    };
    const repository = {
        id: 'repo_demo',
        workspaceId: workspace.id,
        githubRepoId: 424242n,
        fullName: 'demo/app',
        defaultBranch: 'main',
        private: true,
        scanEnabled: true
    };
    const finding = {
        id: 'find_demo',
        repositoryId: repository.id,
        provider: 'openai',
        fingerprint: 'hmac_sha256:openai:demo-fingerprint',
        secretHash: 'sha256:redacted-demo-hash',
        confidence: 0.98,
        severity: 'critical',
        filePath: 'src/config.ts',
        lineNumber: 42,
        contextExcerpt: 'OPENAI_API_KEY=sk-...REDACTED',
        status: 'open'
    };
    const incident = {
        id: 'inc_demo',
        workspaceId: workspace.id,
        findingId: finding.id,
        title: 'Critical OpenAI credential exposure detected',
        severity: 'critical',
        status: 'open',
        provider: finding.provider
    };
    return { account, workspace, repository, finding, incident };
}
