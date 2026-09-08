import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

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

  it('deletes an owned project', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const deletion = await agent.delete(`/api/projects/${project.id}`);
    const read = await agent.get(`/api/projects/${project.id}`);

    expect(deletion.status).toBe(204);
    expect(deletion.text).toBe('');
    expect(read.status).toBe(404);
  });
});
