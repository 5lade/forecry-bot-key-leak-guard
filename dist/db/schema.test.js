import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createDemoRecordPath } from './mockPath.js';
test('mock persistence path creates account -> workspace -> repository -> finding -> incident', () => {
    const path = createDemoRecordPath();
    assert.equal(path.workspace.accountId, path.account.id);
    assert.equal(path.repository.workspaceId, path.workspace.id);
    assert.equal(path.finding.repositoryId, path.repository.id);
    assert.equal(path.incident.workspaceId, path.workspace.id);
    assert.equal(path.incident.findingId, path.finding.id);
    assert.equal(path.finding.severity, 'critical');
});
test('Prisma schema has no raw secret storage fields', () => {
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');
    assert.doesNotMatch(schema, /raw_?secret|secret_?value|plaintext_?secret|token_?value/i);
    assert.match(schema, /secretHash\s+String\s+@map\("secret_hash"\)/);
    assert.match(schema, /contextExcerpt\s+String\s+@map\("context_excerpt"\)/);
});
