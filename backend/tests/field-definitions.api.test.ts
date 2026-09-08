import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createFieldDefinition,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('field definition routes', () => {
  describe('authentication guard', () => {
    it('rejects unauthenticated field definition requests', async () => {
      const api = await getApiClient();

      const responses = await Promise.all([
        api.get('/api/field-definitions?projectId=1'),
        api
          .post('/api/field-definitions')
          .send({ projectId: 1, name: 'Hours', fieldType: 'number' }),
        api.get('/api/field-definitions/1'),
        api.put('/api/field-definitions/1').send({ name: 'Updated' }),
        api.delete('/api/field-definitions/1'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    });
  });

  describe('CRUD', () => {
    it('creates a field definition and reads it back', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const created = await createFieldDefinition(agent, project.id, {
        name: 'Hours',
        fieldType: 'number',
      });

      expect(created).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Hours',
          fieldType: 'number',
          projectId: project.id,
        }),
      );

      const read = await agent.get(`/api/field-definitions/${created.id}`);
      expect(read.status).toBe(200);
      expect(read.body).toEqual(expect.objectContaining({ id: created.id, name: 'Hours' }));
    });

    it('lists field definitions for a project', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const field = await createFieldDefinition(agent, project.id);

      const response = await agent.get(`/api/field-definitions?projectId=${project.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: field.id })]),
      );
    });

    it('updates a field definition', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const field = await createFieldDefinition(agent, project.id, {
        name: 'Hours',
        fieldType: 'number',
      });

      const response = await agent.put(`/api/field-definitions/${field.id}`).send({
        name: 'Duration',
        fieldType: 'duration',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({ name: 'Duration', fieldType: 'duration' }),
      );
    });

    it('deletes a field definition', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const field = await createFieldDefinition(agent, project.id);

      const deletion = await agent.delete(`/api/field-definitions/${field.id}`);
      const read = await agent.get(`/api/field-definitions/${field.id}`);

      expect(deletion.status).toBe(204);
      expect(read.status).toBe(404);
    });

    it('rejects invalid field definition IDs', async () => {
      const { agent } = await createAuthenticatedUser();

      const responses = await Promise.all([
        agent.get('/api/field-definitions/not-an-id'),
        agent.put('/api/field-definitions/not-an-id').send({ name: 'Updated' }),
        agent.delete('/api/field-definitions/not-an-id'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(400);
      }
    });

    it('returns 404 for missing field definitions', async () => {
      const { agent } = await createAuthenticatedUser();
      const missingId = 2147483647;

      const responses = await Promise.all([
        agent.get(`/api/field-definitions/${missingId}`),
        agent.put(`/api/field-definitions/${missingId}`).send({ name: 'Updated' }),
        agent.delete(`/api/field-definitions/${missingId}`),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(404);
      }
    });
  });

  describe('field type validation (#78)', () => {
    it('rejects an invalid field type on creation', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.post('/api/field-definitions').send({
        projectId: project.id,
        name: 'Invalid',
        fieldType: 'invalid',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid field type. Valid options are: text, number, date, duration, boolean',
      });
    });

    it('rejects an invalid field type on update', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const field = await createFieldDefinition(agent, project.id);

      const response = await agent.put(`/api/field-definitions/${field.id}`).send({
        fieldType: 'bogus',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Invalid field type. Valid options are: text, number, date, duration, boolean',
      });
    });
  });

  describe('ownership', () => {
    it('hides field definitions owned by another user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();
      const project = await createProject(owner.agent);
      const field = await createFieldDefinition(owner.agent, project.id);

      const responses = await Promise.all([
        otherUser.agent.get(`/api/field-definitions/${field.id}`),
        otherUser.agent.put(`/api/field-definitions/${field.id}`).send({ name: 'Hacked' }),
        otherUser.agent.delete(`/api/field-definitions/${field.id}`),
      ]);

      for (const response of responses) {
        expect([403, 404]).toContain(response.status);
      }

      const ownerRead = await owner.agent.get(`/api/field-definitions/${field.id}`);
      expect(ownerRead.status).toBe(200);
    });

    it('rejects field definition creation for a project owned by another user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const response = await otherUser.agent.post('/api/field-definitions').send({
        projectId: project.id,
        name: 'Hours',
        fieldType: 'number',
      });

      expect(response.status).toBe(404);
    });

    it('rejects listing field definitions for a project owned by another user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const response = await otherUser.agent.get(`/api/field-definitions?projectId=${project.id}`);

      expect(response.status).toBe(404);
    });
  });
});
