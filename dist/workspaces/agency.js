import { ensureTelegramWorkspace, listSnapshotsForAccount, setActiveWorkspaceForTelegramChat } from '../onboarding/localStore.js';
const repoClients = new Map();
export function createClientWorkspace(identity, name) {
    const base = ensureTelegramWorkspace(identity);
    const clientName = normalizeClientName(name);
    if (!clientName)
        return { ok: false, text: 'Usage: /workspace create <client name>' };
    const slug = slugify(clientName);
    const workspaceId = `wksp_tg_${BigInt(Number(identity.chatId)).toString()}_${slug}`;
    const snapshot = setActiveWorkspaceForTelegramChat(identity.chatId, {
        id: workspaceId,
        accountId: base.account.id,
        name: clientName,
        clientName
    });
    return { ok: true, text: `Created and selected workspace "${clientName}" (${snapshot.workspace.id}). Use /workspace list to see all client workspaces.`, snapshot };
}
export function listClientWorkspaces(identity) {
    const active = ensureTelegramWorkspace(identity);
    const snapshots = listSnapshotsForAccount(active.account.id);
    const lines = snapshots.map((snapshot) => {
        const marker = snapshot.workspace.id === active.workspace.id ? '*' : '-';
        return `${marker} ${snapshot.workspace.name} (${snapshot.workspace.id}) — ${snapshot.repositories.length} repo${snapshot.repositories.length === 1 ? '' : 's'}`;
    });
    return { ok: true, text: `Client workspaces:\n${lines.join('\n')}`, snapshot: active };
}
export function selectClientWorkspace(identity, selector) {
    const active = ensureTelegramWorkspace(identity);
    const needle = selector.trim().toLowerCase();
    if (!needle)
        return { ok: false, text: 'Usage: /workspace select <workspace id|name>' };
    const match = listSnapshotsForAccount(active.account.id).find((snapshot) => snapshot.workspace.id.toLowerCase() === needle || snapshot.workspace.name.toLowerCase() === needle);
    if (!match)
        return { ok: false, text: `Unknown workspace "${selector}". Use /workspace list to see available client workspaces.` };
    const snapshot = setActiveWorkspaceForTelegramChat(identity.chatId, match.workspace);
    return { ok: true, text: `Selected workspace "${snapshot.workspace.name}". /status will now show this client's repo list and incident count.`, snapshot };
}
export function assignRepositoryToClient(snapshot, repoSelector, clientNameInput) {
    const repo = findRepo(snapshot.repositories, repoSelector);
    const clientName = normalizeClientName(clientNameInput);
    if (!repo || !clientName)
        return { ok: false, text: 'Usage: /workspace assign <owner/repo> <client name>' };
    repoClients.set(repo.id, clientName);
    return { ok: true, text: `Assigned ${repo.fullName} to client "${clientName}". Digests and repo lists will group it under that client.`, snapshot };
}
export function renderRepositoryGroups(repositories) {
    if (!repositories.length)
        return 'Repos by client: none connected yet.';
    const groups = groupRepositoriesByClient(repositories);
    return ['Repos by client:', ...Object.entries(groups).map(([client, repos]) => `- ${client}: ${repos.map((repo) => repo.fullName).join(', ')}`)].join('\n');
}
export function renderClientDigestSections(snapshot, incidents) {
    const groups = groupRepositoriesByClient(snapshot.repositories);
    if (!Object.keys(groups).length)
        return 'Client digest sections: none — connect repositories first.';
    const lines = ['Client digest sections:'];
    for (const [client, repos] of Object.entries(groups)) {
        const repoNames = new Set(repos.map((repo) => repo.fullName));
        const clientIncidents = incidents.filter((record) => repoNames.has(record.incident.repo) && record.status !== 'resolved' && record.status !== 'false_positive');
        const critical = clientIncidents.filter((record) => record.incident.severity === 'critical').length;
        lines.push(`- ${client}: ${repos.length} repo${repos.length === 1 ? '' : 's'}, ${clientIncidents.length} active incident${clientIncidents.length === 1 ? '' : 's'}${critical ? ` (${critical} critical)` : ''}`);
    }
    return lines.join('\n');
}
export function resetAgencyWorkspaceState() {
    repoClients.clear();
}
function groupRepositoriesByClient(repositories) {
    const groups = {};
    for (const repo of repositories) {
        const client = repoClients.get(repo.id) ?? 'Unassigned';
        groups[client] ??= [];
        groups[client].push(repo);
    }
    return Object.fromEntries(Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([client, repos]) => [client, repos.sort((a, b) => a.fullName.localeCompare(b.fullName))]));
}
function findRepo(repositories, selector) {
    const needle = selector.trim().toLowerCase();
    return repositories.find((repo) => repo.fullName.toLowerCase() === needle || repo.id.toLowerCase() === needle || repo.fullName.toLowerCase().endsWith(`/${needle}`));
}
function normalizeClientName(value) {
    return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}
function slugify(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'client';
}
