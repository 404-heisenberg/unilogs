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

describe('stats routes', () => {
  describe('authentication guard', () => {
    it('rejects unauthenticated stats requests', async () => {
      const api = await getApiClient();

      const responses = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/stats/project/1'),
        api.get('/api/stats/frequency'),
        api.get('/api/stats/streak'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    }, 30_000);
  });

  describe('GET /api/stats', () => {
    it('returns aggregated stats across all user projects', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent, { name: 'Stats project' });
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'duration' });
      await createEntry(agent, project.id, {
        date: new Date().toISOString().slice(0, 10),
        content: { Hours: 5 },
      });
      await createEntry(agent, project.id, {
        date: new Date().toISOString().slice(0, 10),
        content: { Hours: 3 },
      });

      const response = await agent.get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        perProject: expect.arrayContaining([
          expect.objectContaining({
            projectId: project.id,
            projectName: 'Stats project',
            totalHours: 8,
          }),
        ]),
        totalHours: 8,
        streak: expect.any(Number),
      });
    });

    it('returns zero stats when the user has no entries', async () => {
      const { agent } = await createAuthenticatedUser();
      await createProject(agent);

      const response = await agent.get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        perProject: expect.any(Array),
        totalHours: 0,
        streak: 0,
      });
    });

    it('only counts duration fields for hour totals', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'duration' });
      await createFieldDefinition(agent, project.id, { name: 'Notes', fieldType: 'text' });
      await createEntry(agent, project.id, {
        date: new Date().toISOString().slice(0, 10),
        content: { Hours: 4, Notes: 'did some work' },
      });

      const response = await agent.get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(4);
    });
  });

  describe('GET /api/stats/project/:projectId', () => {
    it('returns stats for a specific project', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent, { name: 'Specific project' });
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'duration' });
      await createEntry(agent, project.id, {
        date: new Date().toISOString().slice(0, 10),
        content: { Hours: 7 },
      });

      const response = await agent.get(`/api/stats/project/${project.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        projectId: project.id,
        projectName: 'Specific project',
        totalHours: 7,
      });
    });

    it('rejects invalid project IDs', async () => {
      const { agent } = await createAuthenticatedUser();

      const response = await agent.get('/api/stats/project/not-an-id');

      expect(response.status).toBe(400);
    });

    it('returns 404 for missing projects', async () => {
      const { agent } = await createAuthenticatedUser();

      const response = await agent.get('/api/stats/project/2147483647');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/stats/frequency', () => {
    it('returns weekly counts and term totals', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, {
        date: new Date().toISOString().slice(0, 10),
        content: {},
      });

      const response = await agent.get('/api/stats/frequency');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        weekly: expect.arrayContaining([
          expect.objectContaining({ weekStart: expect.any(String), count: expect.any(Number) }),
        ]),
        terms: expect.arrayContaining([
          expect.objectContaining({ termName: expect.any(String), total: expect.any(Number) }),
        ]),
      });

      const totalEntries = response.body.weekly.reduce(
        (sum: number, week: { count: number }) => sum + week.count,
        0,
      );
      const totalTerms = response.body.terms.reduce(
        (sum: number, term: { total: number }) => sum + term.total,
        0,
      );
      expect(totalTerms).toBe(totalEntries);
    });
  });

  describe('GET /api/stats/streak', () => {
    it('returns the current streak for the signed-in user', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, {
        date: new Date().toISOString().slice(0, 10),
        content: {},
      });

      const response = await agent.get('/api/stats/streak');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ streak: expect.any(Number) });
      expect(response.body.streak).toBeGreaterThanOrEqual(1);
    });

    it('returns zero for users with no entries', async () => {
      const { agent } = await createAuthenticatedUser();
      await createProject(agent);

      const response = await agent.get('/api/stats/streak');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ streak: 0 });
    });
  });

  describe('ownership', () => {
    it('hides project stats owned by another user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const response = await otherUser.agent.get(`/api/stats/project/${project.id}`);

      expect(response.status).toBe(404);
    });

    it('only includes stats for projects owned by the signed-in user', async () => {
      const owner = await createAuthenticatedUser();
      const otherUser = await createAuthenticatedUser();

      const ownerProject = await createProject(owner.agent, { name: 'Owner project' });
      await createFieldDefinition(owner.agent, ownerProject.id, {
        name: 'Hours',
        fieldType: 'duration',
      });
      await createEntry(owner.agent, ownerProject.id, {
        date: new Date().toISOString().slice(0, 10),
        content: { Hours: 2 },
      });

      const otherProject = await createProject(otherUser.agent, { name: 'Other project' });
      await createFieldDefinition(otherUser.agent, otherProject.id, {
        name: 'Hours',
        fieldType: 'duration',
      });
      await createEntry(otherUser.agent, otherProject.id, {
        date: new Date().toISOString().slice(0, 10),
        content: { Hours: 99 },
      });

      const response = await owner.agent.get('/api/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalHours).toBe(2);
      expect(response.body.perProject).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ projectId: ownerProject.id, totalHours: 2 }),
        ]),
      );
      expect(response.body.perProject).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ projectId: otherProject.id })]),
      );
    });
  });
});
