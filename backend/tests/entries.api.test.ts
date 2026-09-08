import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createFieldDefinition,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('entry routes', () => {
  describe('authentication guard', () => {
    it('rejects unauthenticated entry requests', async () => {
      const api = await getApiClient();

      const responses = await Promise.all([
        api.get('/api/entries'),
        api.post('/api/entries').send({ projectId: 1, content: {} }),
        api.get('/api/entries/1'),
        api.put('/api/entries/1').send({ content: {} }),
        api.delete('/api/entries/1'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    }, 30_000);
  });

  describe('CRUD', () => {
    it('creates an entry and reads it back', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const created = await createEntry(agent, project.id, {
        date: '2025-09-01',
        content: { Hours: 3 },
      });

      expect(created).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          date: expect.any(String),
          content: { Hours: 3 },
        }),
      );

      const read = await agent.get(`/api/entries/${created.id}`);
      expect(read.status).toBe(200);
      expect(read.body).toEqual(expect.objectContaining({ id: created.id }));
    });

    it('lists entries for the signed-in user', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const entry = await createEntry(agent, project.id);

      const response = await agent.get('/api/entries');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: entry.id })]),
      );
    });

    it('updates an entry', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });
      const entry = await createEntry(agent, project.id, {
        date: '2025-09-01',
        content: { Hours: 2 },
      });

      const response = await agent.put(`/api/entries/${entry.id}`).send({
        content: { Hours: 5 },
        date: '2025-09-02',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ content: { Hours: 5 } }));
    });

    it('deletes an entry', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const entry = await createEntry(agent, project.id);

      const deletion = await agent.delete(`/api/entries/${entry.id}`);
      const read = await agent.get(`/api/entries/${entry.id}`);

      expect(deletion.status).toBe(204);
      expect(read.status).toBe(404);
    });

    it('rejects invalid entry IDs', async () => {
      const { agent } = await createAuthenticatedUser();

      const responses = await Promise.all([
        agent.get('/api/entries/not-an-id'),
        agent.put('/api/entries/not-an-id').send({ content: {} }),
        agent.delete('/api/entries/not-an-id'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(400);
      }
    });

    it('returns 404 for missing entries', async () => {
      const { agent } = await createAuthenticatedUser();
      const missingId = 2147483647;

      const responses = await Promise.all([
        agent.get(`/api/entries/${missingId}`),
        agent.put(`/api/entries/${missingId}`).send({ content: {} }),
        agent.delete(`/api/entries/${missingId}`),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(404);
      }
    });
  });

  describe('content validation (#79)', () => {
    it('rejects content missing a required field', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        date: '2025-09-01',
        content: {},
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain("Field 'Hours' is required");
    });

    it('rejects content with the wrong value type', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        date: '2025-09-01',
        content: { Hours: 'not-a-number' },
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain("Field 'Hours' must be a number");
    });

    it('rejects content with an unknown field key', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        date: '2025-09-01',
        content: { Hours: 5, Unknown: 'extra' },
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain("Unknown field 'Unknown'");
    });

    it('rejects non-object content', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        date: '2025-09-01',
        content: 'not-an-object',
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain('Content must be an object');
    });

    it('applies the same validation on PUT /api/entries/:id', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });
      const entry = await createEntry(agent, project.id, {
        date: '2025-09-01',
        content: { Hours: 2 },
      });

      const response = await agent.put(`/api/entries/${entry.id}`).send({
        content: { Hours: 'wrong-type' },
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain("Field 'Hours' must be a number");
    });
  });

  describe('ownership', () => {
    it('hides entries owned by another user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();
      const project = await createProject(owner.agent);
      const entry = await createEntry(owner.agent, project.id);

      const responses = await Promise.all([
        otherUser.agent.get(`/api/entries/${entry.id}`),
        otherUser.agent.put(`/api/entries/${entry.id}`).send({ content: {} }),
        otherUser.agent.delete(`/api/entries/${entry.id}`),
      ]);

      for (const response of responses) {
        expect([403, 404]).toContain(response.status);
      }

      const ownerRead = await owner.agent.get(`/api/entries/${entry.id}`);
      expect(ownerRead.status).toBe(200);
    });

    it('rejects entry creation for a project owned by another user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const response = await otherUser.agent.post('/api/entries').send({
        projectId: project.id,
        date: '2025-09-01',
        content: {},
      });

      expect(response.status).toBe(403);
    });
  });
});
