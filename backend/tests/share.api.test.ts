import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createProject,
  createFieldDefinition,
  createEntry,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';
import { createShareToken, verifyShareToken } from '../src/services/share-services.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

async function createShareLink(
  agent: Awaited<ReturnType<typeof createAuthenticatedUser>>['agent'],
  projectId: number,
  body: Record<string, unknown> = {},
) {
  const response = await agent.post(`/api/projects/${projectId}/share-links`).send(body);
  if (response.status !== 201) {
    throw new Error(`Share link creation failed with status ${response.status}`);
  }
  return response.body as { url: string; token: string; expiresAt: string };
}

describe('share link routes', () => {
  it('creates a share link and returns a public url', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const response = await agent.post(`/api/projects/${project.id}/share-links`).send({
      includeBodies: true,
      rangeDays: 7,
    });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.url).toContain(`/share/${response.body.token}`);
    expect(response.body.expiresAt).toEqual(expect.any(String));
  });

  it('rejects creating a share link for a project the user does not own', async () => {
    const owner = await createAuthenticatedUser();
    const project = await createProject(owner.agent);
    const intruder = await createAuthenticatedUser();

    const response = await intruder.agent.post(`/api/projects/${project.id}/share-links`).send({});

    expect(response.status).toBe(404);
  });

  it('rejects invalid share link options', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const responses = await Promise.all([
      agent.post(`/api/projects/${project.id}/share-links`).send({ includeBodies: 'yes' }),
      agent.post(`/api/projects/${project.id}/share-links`).send({ rangeDays: 0 }),
      agent.post(`/api/projects/${project.id}/share-links`).send({ expiresInDays: -1 }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(400);
    }
  });

  it('serves a public read-only report without authentication', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Shared project' });
    await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });
    await createEntry(agent, project.id, { title: 'Entry one', content: { Hours: 2 } });

    const share = await createShareLink(agent, project.id);
    const publicClient = await getApiClient();
    const report = await publicClient.get(`/share/${share.token}`);

    expect(report.status).toBe(200);
    expect(report.body.project).toEqual(expect.objectContaining({ name: 'Shared project' }));
    expect(report.body.includeBodies).toBe(false);
    expect(report.body.fields).toEqual([
      expect.objectContaining({ name: 'Hours', fieldType: 'number' }),
    ]);
    expect(report.body.entries).toHaveLength(1);
    expect(report.body.entries[0]).toEqual(expect.objectContaining({ title: 'Entry one' }));
    expect(report.body.summary).toEqual(expect.objectContaining({ entryCount: 1 }));
  });

  it('only exposes entry bodies when the token includes them', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createEntry(agent, project.id, { title: 'With body', body: 'super secret note' });

    const withoutBodies = await createShareLink(agent, project.id, { includeBodies: false });
    const withBodies = await createShareLink(agent, project.id, { includeBodies: true });

    const publicClient = await getApiClient();
    const hidden = await publicClient.get(`/share/${withoutBodies.token}`);
    const shown = await publicClient.get(`/share/${withBodies.token}`);

    expect(hidden.body.entries[0]).not.toHaveProperty('body');
    expect(shown.body.entries[0].body).toBe('super secret note');
  });

  it('limits the report to the token range', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createEntry(agent, project.id, { title: 'Recent entry', date: daysAgo(1) });
    await createEntry(agent, project.id, { title: 'Old entry', date: daysAgo(60) });

    const share = await createShareLink(agent, project.id, { rangeDays: 30 });
    const publicClient = await getApiClient();
    const report = await publicClient.get(`/share/${share.token}`);

    expect(report.status).toBe(200);
    expect(report.body.entries).toHaveLength(1);
    expect(report.body.entries[0].title).toBe('Recent entry');
  });

  it('returns the same 404 for unknown, revoked and expired tokens', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const revoked = await createShareToken(project.id);
    await agent.delete(`/api/projects/${project.id}/share-links/${revoked.token}`);
    const expired = await createShareToken(project.id, { expiresInDays: -1 });

    const publicClient = await getApiClient();
    const responses = await Promise.all([
      publicClient.get('/share/does-not-exist'),
      publicClient.get(`/share/${revoked.token}`),
      publicClient.get(`/share/${expired.token}`),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Share link not found' });
    }
  });

  it('revokes a link so the public routes immediately 404 it, idempotently', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const share = await createShareLink(agent, project.id);

    const firstRevoke = await agent.delete(
      `/api/projects/${project.id}/share-links/${share.token}`,
    );
    const secondRevoke = await agent.delete(
      `/api/projects/${project.id}/share-links/${share.token}`,
    );
    const publicClient = await getApiClient();
    const report = await publicClient.get(`/share/${share.token}`);

    expect(firstRevoke.status).toBe(204);
    expect(secondRevoke.status).toBe(204);
    expect(report.status).toBe(404);
    expect(await verifyShareToken(share.token)).toBeNull();
  });

  it('keeps exports inside the token range and body setting', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Export project' });
    await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });
    await createEntry(agent, project.id, {
      title: 'Recent entry',
      date: daysAgo(1),
      body: 'super secret note',
      content: { Hours: 3 },
    });
    await createEntry(agent, project.id, {
      title: 'Old entry',
      date: daysAgo(60),
      content: { Hours: 9 },
    });

    const share = await createShareLink(agent, project.id, { rangeDays: 30, includeBodies: false });
    const publicClient = await getApiClient();

    const csv = await publicClient
      .get(`/share/${share.token}/export`)
      .query({ format: 'csv', includeBodies: 'true', dateFrom: '2000-01-01' });

    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('attachment');
    expect(csv.text).toContain('Recent entry');
    expect(csv.text).not.toContain('Old entry');
    expect(csv.text).not.toContain('super secret note');

    const markdown = await publicClient.get(`/share/${share.token}/export`).query({ format: 'md' });

    expect(markdown.status).toBe(200);
    expect(markdown.headers['content-type']).toContain('text/markdown');
    expect(markdown.text).toContain('# Export project');

    const badFormat = await publicClient
      .get(`/share/${share.token}/export`)
      .query({ format: 'pdf' });

    expect(badFormat.status).toBe(400);
  });

  it('revokes every share link when the project is deleted', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const first = await createShareLink(agent, project.id);
    const second = await createShareLink(agent, project.id);

    const deletion = await agent.delete(`/api/projects/${project.id}`);
    const publicClient = await getApiClient();
    const responses = await Promise.all([
      publicClient.get(`/share/${first.token}`),
      publicClient.get(`/share/${second.token}`),
    ]);

    expect(deletion.status).toBe(204);
    for (const response of responses) {
      expect(response.status).toBe(404);
    }
  });

  it('revokes share links when the project is archived, and unarchiving does not restore them', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    const share = await createShareLink(agent, project.id);
    const publicClient = await getApiClient();

    const archive = await agent.post(`/api/projects/${project.id}/archive`);
    const archivedReport = await publicClient.get(`/share/${share.token}`);

    expect(archive.status).toBe(200);
    expect(archivedReport.status).toBe(404);
    expect(await verifyShareToken(share.token)).toBeNull();

    await agent.post(`/api/projects/${project.id}/unarchive`);
    const unarchivedReport = await publicClient.get(`/share/${share.token}`);

    expect(unarchivedReport.status).toBe(404);
  });

  it('rate-limits repeated requests for the same token', async () => {
    const publicClient = await getApiClient();
    const token = 'rate-limit-test-token';

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await publicClient.get(`/share/${token}`);
      expect(response.status).toBe(404);
    }

    const limited = await publicClient.get(`/share/${token}`);

    expect(limited.status).toBe(429);
  });
});
