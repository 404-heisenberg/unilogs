import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createProject,
  createFieldDefinition,
  createEntry,
  createTag,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';
import { createShareToken, verifyShareToken } from '../src/services/share-services.js';
import { prisma } from '../src/auth.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('project routes', () => {
  it('creates a project and lists active projects for the signed-in user', async () => {
    const { agent } = await createAuthenticatedUser();

    const project = await createProject(agent, {
      name: 'Capstone logbook',
      description: 'Weekly project work',
    });
    const response = await agent.get('/api/projects');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        id: project.id,
        name: 'Capstone logbook',
        description: 'Weekly project work',
        archived: false,
      }),
    ]);
  });

  it('rejects unauthenticated project requests', async () => {
    const api = await getApiClient();

    const responses = await Promise.all([
      api.get('/api/projects'),
      api.post('/api/projects').send({ name: 'Unauthenticated project' }),
      api.get('/api/projects/1'),
      api.patch('/api/projects/1').send({ name: 'Updated project' }),
      api.delete('/api/projects/1'),
      api.post('/api/projects/1/archive'),
      api.post('/api/projects/1/unarchive'),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it('rejects project creation without a name', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.post('/api/projects').send({ description: 'No name' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Project name is required!' });
  });

  it('reads and updates an owned project', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, {
      name: 'Initial name',
      description: 'Initial note',
    });

    const read = await agent.get(`/api/projects/${project.id}`);
    const update = await agent.patch(`/api/projects/${project.id}`).send({
      name: 'Updated name',
      description: null,
    });

    expect(read.status).toBe(200);
    expect(read.body).toEqual(expect.objectContaining({ id: project.id, name: 'Initial name' }));
    expect(update.status).toBe(200);
    expect(update.body).toEqual(
      expect.objectContaining({
        id: project.id,
        name: 'Updated name',
        description: null,
      }),
    );
  });

  it('rejects invalid project IDs and invalid project updates', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const responses = await Promise.all([
      agent.get('/api/projects/not-an-id'),
      agent.patch('/api/projects/not-an-id').send({ name: 'Updated project' }),
      agent.delete('/api/projects/not-an-id'),
      agent.post('/api/projects/not-an-id/archive'),
      agent.post('/api/projects/not-an-id/unarchive'),
      agent.patch(`/api/projects/${project.id}`).send({ name: '' }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(400);
    }
  });

  it('returns not found for missing projects', async () => {
    const { agent } = await createAuthenticatedUser();
    const missingProjectId = 2147483647;

    const responses = await Promise.all([
      agent.get(`/api/projects/${missingProjectId}`),
      agent.patch(`/api/projects/${missingProjectId}`).send({ name: 'Updated project' }),
      agent.delete(`/api/projects/${missingProjectId}`),
      agent.post(`/api/projects/${missingProjectId}/archive`),
      agent.post(`/api/projects/${missingProjectId}/unarchive`),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
    }
  });

  it('hides projects owned by another user', async () => {
    const owner = await createAuthenticatedUser();
    const otherUser = await createAuthenticatedUser();
    const project = await createProject(owner.agent);

    const responses = await Promise.all([
      otherUser.agent.get(`/api/projects/${project.id}`),
      otherUser.agent.patch(`/api/projects/${project.id}`).send({ name: 'Updated project' }),
      otherUser.agent.delete(`/api/projects/${project.id}`),
      otherUser.agent.post(`/api/projects/${project.id}/archive`),
      otherUser.agent.post(`/api/projects/${project.id}/unarchive`),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(404);
    }

    const ownerRead = await owner.agent.get(`/api/projects/${project.id}`);
    expect(ownerRead.status).toBe(200);
  });

  it('archives and unarchives owned projects', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Archive me' });

    const archive = await agent.post(`/api/projects/${project.id}/archive`);
    const activeProjects = await agent.get('/api/projects');
    const archivedProjects = await agent.get('/api/projects?archived=true');
    const unarchive = await agent.post(`/api/projects/${project.id}/unarchive`);

    expect(archive.status).toBe(200);
    expect(archive.body).toEqual(expect.objectContaining({ id: project.id, archived: true }));
    expect(activeProjects.status).toBe(200);
    expect(activeProjects.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: project.id })]),
    );
    expect(archivedProjects.status).toBe(200);
    expect(archivedProjects.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: project.id, archived: true })]),
    );
    expect(unarchive.status).toBe(200);
    expect(unarchive.body).toEqual(expect.objectContaining({ id: project.id, archived: false }));
  });

  it('returns a project summary with duration fields', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    await createFieldDefinition(agent, project.id, {
      name: 'Hours',
      fieldType: 'duration',
    });

    const entryDate = new Date();
    const entryDateString = entryDate.toISOString().slice(0, 10);

    await createEntry(agent, project.id, {
      date: entryDateString,
      content: { Hours: 2 },
    });

    const response = await agent.get(`/api/projects/${project.id}/summary`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        projectId: project.id,
        name: project.name,
        entryCount: 1,
        trackedTimeMinutes: 120,
        lastLoggedAt: new Date(`${entryDateString}T00:00:00.000Z`).toISOString(),
        entriesThisWeek: 1,
      }),
    );
  });

  it('returns a project summary without tracked time when there is no duration field', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    await createFieldDefinition(agent, project.id, {
      name: 'Complete',
      fieldType: 'boolean',
    });

    const entryDate = new Date();
    const entryDateString = entryDate.toISOString().slice(0, 10);

    await createEntry(agent, project.id, {
      date: entryDateString,
      content: { Complete: true },
    });

    const response = await agent.get(`/api/projects/${project.id}/summary`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projectId: project.id,
      name: project.name,
      entryCount: 1,
      trackedTimeMinutes: null,
      lastLoggedAt: new Date(`${entryDateString}T00:00:00.000Z`).toISOString(),
      entriesThisWeek: 1,
    });
  });

  it('sums duration and uses the latest entry date for multiple entries', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    await createFieldDefinition(agent, project.id, {
      name: 'Hours',
      fieldType: 'duration',
    });

    const olderDate = new Date();
    olderDate.setUTCDate(olderDate.getUTCDate() - 2);
    const newerDate = new Date();
    newerDate.setUTCDate(newerDate.getUTCDate() - 1);

    const olderDateString = olderDate.toISOString().slice(0, 10);
    const newerDateString = newerDate.toISOString().slice(0, 10);

    await createEntry(agent, project.id, {
      date: olderDateString,
      content: { Hours: 2 },
    });

    await createEntry(agent, project.id, {
      date: newerDateString,
      content: { Hours: 4 },
    });

    const response = await agent.get(`/api/projects/${project.id}/summary`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        projectId: project.id,
        entryCount: 2,
        trackedTimeMinutes: 360,
        lastLoggedAt: new Date(`${newerDateString}T00:00:00.000Z`).toISOString(),
        entriesThisWeek: 2,
      }),
    );
  });

  it('returns 404 for a project owned by another user', async () => {
    const owner = await createAuthenticatedUser();
    const otherUser = await createAuthenticatedUser();
    const project = await createProject(owner.agent);

    const response = await otherUser.agent.get(`/api/projects/${project.id}/summary`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'project not found' });
  });

  it('deletes an owned project', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const deletion = await agent.delete(`/api/projects/${project.id}`);
    const read = await agent.get(`/api/projects/${project.id}`);

    expect(deletion.status).toBe(204);
    expect(deletion.text).toBe('');
    expect(read.status).toBe(404);
  });

  it('deletes a project and cascades to its related data', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const share = await createShareToken(project.id);

    const field = await createFieldDefinition(agent, project.id);
    const entry = await createEntry(agent, project.id, {
      content: { Hours: 1 },
    });
    const tag = await createTag(agent, 'testing');

    await prisma.entryTag.create({
      data: {
        entryId: entry.id,
        tagId: tag.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        entryId: entry.id,
        action: 'CREATE',
        newData: { title: 'Test entry' },
      },
    });

    const deletion = await agent.delete(`/api/projects/${project.id}`);

    expect(deletion.status).toBe(204);
    expect(await verifyShareToken(share.token)).toBeNull();

    const shareTokenCount = await prisma.shareToken.count({
      where: { token: share.token },
    });

    const fieldCount = await prisma.fieldDefinition.count({
      where: { id: field.id },
    });

    const entryCount = await prisma.entry.count({
      where: { id: entry.id },
    });

    const entryTagCount = await prisma.entryTag.count({
      where: { entryId: entry.id },
    });

    const auditLogCount = await prisma.auditLog.count({
      where: { entryId: entry.id },
    });

    expect(fieldCount).toBe(0);
    expect(entryCount).toBe(0);
    expect(entryTagCount).toBe(0);
    expect(auditLogCount).toBe(0);
    expect(shareTokenCount).toBe(0);

    const secondDeletion = await agent.delete(`/api/projects/${project.id}`);

    expect(secondDeletion.status).toBe(404);
  });
});
