import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
} from './helpers/api.js';
import {
  createShareToken,
  revokeProjectShares,
  revokeShareToken,
  verifyShareToken,
} from '../src/services/share-services.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('createShareToken', () => {
  it('creates a token with the default range, body setting and future expiry', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const share = await createShareToken(project.id);

    expect(share.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(share.projectId).toBe(project.id);
    expect(share.includeBodies).toBe(false);
    expect(share.defaultRangeDays).toBe(30);
    expect(share.revokedAt).toBeNull();
    expect(share.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('honours the requested options', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const share = await createShareToken(project.id, {
      includeBodies: true,
      defaultRangeDays: 7,
    });

    expect(share.includeBodies).toBe(true);
    expect(share.defaultRangeDays).toBe(7);
  });
});

describe('verifyShareToken', () => {
  it('returns the token while it is live', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const share = await createShareToken(project.id);

    const verified = await verifyShareToken(share.token);

    expect(verified?.token).toBe(share.token);
  });

  it('returns null for an unknown token', async () => {
    expect(await verifyShareToken('does-not-exist')).toBeNull();
  });

  it('returns null for a revoked token', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const share = await createShareToken(project.id);

    await revokeShareToken(project.id, share.token);

    expect(await verifyShareToken(share.token)).toBeNull();
  });

  it('returns null for an expired token', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const share = await createShareToken(project.id, { expiresInDays: -1 });

    expect(await verifyShareToken(share.token)).toBeNull();
  });
});

describe('revokeShareToken', () => {
  it('is idempotent', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const share = await createShareToken(project.id);

    expect(await revokeShareToken(project.id, share.token)).toBe(1);
    expect(await revokeShareToken(project.id, share.token)).toBe(0);
  });
});

describe('revokeProjectShares', () => {
  it('revokes every live token for the project and leaves other projects alone', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const other = await createProject(agent);
    const first = await createShareToken(project.id);
    const second = await createShareToken(project.id);
    const untouched = await createShareToken(other.id);

    const revoked = await revokeProjectShares(project.id);

    expect(revoked).toBe(2);
    expect(await verifyShareToken(first.token)).toBeNull();
    expect(await verifyShareToken(second.token)).toBeNull();
    expect((await verifyShareToken(untouched.token))?.token).toBe(untouched.token);
  });

  it('is idempotent', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createShareToken(project.id);

    expect(await revokeProjectShares(project.id)).toBe(1);
    expect(await revokeProjectShares(project.id)).toBe(0);
  });
});
