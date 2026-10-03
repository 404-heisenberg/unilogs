import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createFieldDefinition,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('stat panels', () => {
  describe('CRUD', () => {
    it('creates a panel and returns the computed Sum', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      await createFieldDefinition(agent, project.id, {
        name: 'weight',
        fieldType: 'number',
      });
      await createFieldDefinition(agent, project.id, {
        name: 'reps',
        fieldType: 'number',
      });

      await createEntry(agent, project.id, { content: { weight: 50, reps: 10 } });
      await createEntry(agent, project.id, { content: { weight: 60, reps: 8 } });

      const res = await agent.post(`/api/projects/${project.id}/stat-panels`).send({
        name: 'Total volume',
        expression: 'weight * reps',
        aggregation: 'sum',
      });

      expect(res.status).toBe(201);
      expect(res.body.value).toBe(50 * 10 + 60 * 8);
      expect(res.body.sampleCount).toBe(2);
      expect(Array.isArray(res.body.series)).toBe(true);
    });

    it('returns the Average when aggregation is average', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      await createFieldDefinition(agent, project.id, {
        name: 'weight',
        fieldType: 'number',
      });

      await createEntry(agent, project.id, { content: { weight: 40 } });
      await createEntry(agent, project.id, { content: { weight: 60 } });

      const res = await agent.post(`/api/projects/${project.id}/stat-panels`).send({
        name: 'Avg weight',
        expression: 'weight',
        aggregation: 'average',
      });

      expect(res.status).toBe(201);
      expect(res.body.value).toBe(50);
    });

    it('lists panels with values', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, {
        name: 'x',
        fieldType: 'number',
      });
      await createEntry(agent, project.id, { content: { x: 5 } });

      await agent.post(`/api/projects/${project.id}/stat-panels`).send({
        name: 'X total',
        expression: 'x',
      });

      const res = await agent.get(`/api/projects/${project.id}/stat-panels`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].value).toBe(5);
    });

    it('deletes a panel', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, {
        name: 'x',
        fieldType: 'number',
      });

      const created = await agent
        .post(`/api/projects/${project.id}/stat-panels`)
        .send({ name: 'X', expression: 'x' });

      const res = await agent.delete(`/api/projects/${project.id}/stat-panels/${created.body.id}`);
      expect(res.status).toBe(204);
    });
  });

  describe('preview', () => {
    it('evaluates without persisting', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, {
        name: 'weight',
        fieldType: 'number',
      });
      await createEntry(agent, project.id, { content: { weight: 42 } });

      const res = await agent
        .post(`/api/projects/${project.id}/stat-panels/preview`)
        .send({ expression: 'weight', aggregation: 'sum' });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe(42);

      const list = await agent.get(`/api/projects/${project.id}/stat-panels`);
      expect(list.body).toHaveLength(0);
    });

    it('rejects an unknown identifier with 400', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const res = await agent
        .post(`/api/projects/${project.id}/stat-panels/preview`)
        .send({ expression: 'mystery + 1' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/unknown field/i);
    });

    it('rejects a bad aggregation value', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const res = await agent
        .post(`/api/projects/${project.id}/stat-panels/preview`)
        .send({ expression: '1', aggregation: 'median' });

      expect(res.status).toBe(400);
    });

    it('rejects an empty expression', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const res = await agent
        .post(`/api/projects/${project.id}/stat-panels/preview`)
        .send({ expression: '   ' });

      expect(res.status).toBe(400);
    });
  });

  describe('ownership', () => {
    it("does not let one user see another user's project panels", async () => {
      const owner = await createAuthenticatedUser();
      const other = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const res = await other.agent.get(`/api/projects/${project.id}/stat-panels`);
      expect(res.status).toBe(404);
    });

    it("does not let one user delete another user's panel", async () => {
      const owner = await createAuthenticatedUser();
      const other = await createAuthenticatedUser();
      const project = await createProject(owner.agent);
      await createFieldDefinition(owner.agent, project.id, {
        name: 'x',
        fieldType: 'number',
      });

      const created = await owner.agent
        .post(`/api/projects/${project.id}/stat-panels`)
        .send({ name: 'X', expression: 'x' });

      const res = await other.agent.delete(
        `/api/projects/${project.id}/stat-panels/${created.body.id}`,
      );
      expect([403, 404]).toContain(res.status);
    });

    it("does not let one user read another user's project on preview", async () => {
      const owner = await createAuthenticatedUser();
      const other = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const res = await other.agent
        .post(`/api/projects/${project.id}/stat-panels/preview`)
        .send({ expression: '1' });

      expect(res.status).toBe(404);
    });
  });

  describe('soft-deleted entries', () => {
    it('does not count soft-deleted entries', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      await createFieldDefinition(agent, project.id, {
        name: 'x',
        fieldType: 'number',
      });

      const entry = await createEntry(agent, project.id, {
        content: { x: 10 },
      });
      await createEntry(agent, project.id, { content: { x: 5 } });

      await agent.delete(`/api/entries/${entry.id}`);

      const res = await agent
        .post(`/api/projects/${project.id}/stat-panels/preview`)
        .send({ expression: 'x', aggregation: 'sum' });

      expect(res.status).toBe(200);
      expect(res.body.value).toBe(5);
    });
  });
});
