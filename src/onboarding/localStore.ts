import type { AccountRecord, RepositoryRecord, WorkspaceRecord } from '../domain/types.js';

export interface InstallationRecord {
  id: string;
  workspaceId: string;
  githubInstallationId: bigint;
  accountLogin?: string;
  selectedRepositoriesUrl?: string;
  setupAction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingSnapshot {
  account: AccountRecord;
  workspace: WorkspaceRecord;
  installation?: InstallationRecord;
  repositories: RepositoryRecord[];
}

const accounts = new Map<string, AccountRecord>();
const workspaces = new Map<string, WorkspaceRecord>();
const installations = new Map<string, InstallationRecord>();
const repositories = new Map<string, RepositoryRecord>();

export interface TelegramIdentity {
  chatId: number | string;
  userId?: number;
  username?: string;
  firstName?: string;
}

export function ensureTelegramWorkspace(identity: TelegramIdentity): OnboardingSnapshot {
  const numericUser = BigInt(identity.userId ?? Number(identity.chatId));
  const numericChat = BigInt(Number(identity.chatId));
  const accountId = `acct_tg_${numericUser.toString()}`;
  const workspaceId = `wksp_tg_${numericChat.toString()}`;
  const account = accounts.get(accountId) ?? {
    id: accountId,
    telegramUserId: numericUser,
    telegramChatId: numericChat,
    displayName: identity.username ? `@${identity.username}` : identity.firstName ?? 'Telegram founder',
    plan: 'trial'
  };
  accounts.set(account.id, account);
  const workspace = workspaces.get(workspaceId) ?? {
    id: workspaceId,
    accountId: account.id,
    name: identity.username ? `${identity.username}'s workspace` : 'Telegram workspace'
  };
  workspaces.set(workspace.id, workspace);
  return snapshotForWorkspace(workspace.id)!;
}

export function getWorkspace(workspaceId: string): WorkspaceRecord | undefined {
  return workspaces.get(workspaceId);
}

export function snapshotForWorkspace(workspaceId: string): OnboardingSnapshot | undefined {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return undefined;
  const account = accounts.get(workspace.accountId);
  if (!account) return undefined;
  const installation = [...installations.values()].find((item) => item.workspaceId === workspaceId);
  const repos = [...repositories.values()].filter((repo) => repo.workspaceId === workspaceId).sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { account, workspace, installation, repositories: repos };
}

export function snapshotForTelegramChat(chatId: number | string): OnboardingSnapshot | undefined {
  return snapshotForWorkspace(`wksp_tg_${BigInt(Number(chatId)).toString()}`);
}

export function recordGitHubInstallation(input: {
  workspaceId: string;
  installationId: number | string | bigint;
  accountLogin?: string;
  setupAction?: string;
  selectedRepositoriesUrl?: string;
  repositories?: Array<{ id?: number | string | bigint; fullName: string; defaultBranch?: string; private?: boolean }>;
}): OnboardingSnapshot {
  const workspace = workspaces.get(input.workspaceId);
  if (!workspace) throw new Error(`workspace_not_found:${input.workspaceId}`);
  const now = new Date().toISOString();
  const installationKey = `ghinst_${BigInt(input.installationId).toString()}`;
  const existing = installations.get(installationKey);
  installations.set(installationKey, {
    id: installationKey,
    workspaceId: input.workspaceId,
    githubInstallationId: BigInt(input.installationId),
    accountLogin: input.accountLogin,
    selectedRepositoriesUrl: input.selectedRepositoriesUrl,
    setupAction: input.setupAction,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  });
  for (const repo of input.repositories ?? []) {
    const repoId = `repo_${sanitizeId(repo.fullName)}`;
    repositories.set(repoId, {
      id: repoId,
      workspaceId: input.workspaceId,
      githubRepoId: BigInt(repo.id ?? stableNumericId(repo.fullName)),
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch ?? 'main',
      private: repo.private ?? true,
      scanEnabled: true
    });
  }
  return snapshotForWorkspace(input.workspaceId)!;
}

export function purgeWorkspace(workspaceId: string): { workspaceDeleted: boolean; repositoriesDeleted: number; installationsDeleted: number; accountDeleted: boolean } {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) return { workspaceDeleted: false, repositoriesDeleted: 0, installationsDeleted: 0, accountDeleted: false };
  let repositoriesDeleted = 0;
  for (const [id, repo] of repositories) {
    if (repo.workspaceId === workspaceId) {
      repositories.delete(id);
      repositoriesDeleted += 1;
    }
  }
  let installationsDeleted = 0;
  for (const [id, installation] of installations) {
    if (installation.workspaceId === workspaceId) {
      installations.delete(id);
      installationsDeleted += 1;
    }
  }
  workspaces.delete(workspaceId);
  const accountHasWorkspaces = [...workspaces.values()].some((item) => item.accountId === workspace.accountId);
  const accountDeleted = !accountHasWorkspaces;
  if (accountDeleted) accounts.delete(workspace.accountId);
  return { workspaceDeleted: true, repositoriesDeleted, installationsDeleted, accountDeleted };
}

export function resetOnboardingStore() {
  accounts.clear();
  workspaces.clear();
  installations.clear();
  repositories.clear();
}

function sanitizeId(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function stableNumericId(value: string): number {
  let hash = 5381;
  for (const ch of value) hash = ((hash << 5) + hash + ch.charCodeAt(0)) >>> 0;
  return hash || 1;
}
