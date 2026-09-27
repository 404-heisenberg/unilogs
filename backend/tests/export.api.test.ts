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

describe('export routes', () => {
  describe('GET /api/export', () => {
    it('rejects unauthenticated export requests', async () => {
      const api = await getApiClient();

      const responses = await Promise.all([
        api.get('/api/export?projectId=1&format=csv'),
        api.get('/api/export?projectId=1&format=md'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    });

    it('exports project entries as CSV', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      await createFieldDefinition(agent, project.id, {
        name: 'Hours',
        fieldType: 'number',
      });

      const date = new Date().toISOString().slice(0, 10);

      await createEntry(agent, project.id, {
        date,
        title: 'Test entry',
        content: {
          Hours: 3,
        },
      });

      const response = await agent.get(`/api/export?projectId=${project.id}&format=csv`);
      const safeProjectName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain(`unilogs-${safeProjectName}-`);
      expect(response.text).toContain('date,title,Hours');
      expect(response.text).toContain(new Date(`${date}T00:00:00.000Z`).toDateString());
      expect(response.text).toContain('Test entry');
      expect(response.text).toContain('3');
    });

    it('exports project entries as Markdown', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      await createFieldDefinition(agent, project.id, {
        name: 'Hours',
        fieldType: 'number',
      });

      const date = new Date().toISOString().slice(0, 10);

      await createEntry(agent, project.id, {
        date,
        title: 'Test Entry',
        content: {
          Hours: 3,
        },
      });

      const response = await agent.get(`/api/export?projectId=${project.id}&format=md`);

      const safeProjectName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toContain(`unilogs-${safeProjectName}-`);

      expect(response.text).toContain(`# ${project.name}`);
      expect(response.text).toContain('Test Entry');
      expect(response.text).toContain(new Date(`${date}T00:00:00.000Z`).toDateString());
      expect(response.text).toContain('Hours: 3');
    });

    it('includes entry bodies when requested', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      await createFieldDefinition(agent, project.id, {
        name: 'Hours',
        fieldType: 'number',
      });

      const date = new Date().toISOString().slice(0, 10);

      await createEntry(agent, project.id, {
        date,
        title: 'Test Entry',
        body: 'These are my notes',
        content: {
          Hours: 3,
        },
      });

      const response = await agent.get(
        `/api/export?projectId=${project.id}&format=md&includeBodies=true`,
      );

      expect(response.status).toBe(200);
      expect(response.text).toContain('#### Body');
      expect(response.text).toContain('These are my notes');
    });

    it('exports only entries within the specified date range', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const today = new Date();
      const inRangeDate = new Date(today);
      inRangeDate.setUTCDate(today.getUTCDate() - 1);

      const outofRangeDate = new Date(today);
      outofRangeDate.setUTCDate(today.getUTCDate() - 10);

      const dateFrom = new Date(today);
      dateFrom.setUTCDate(today.getUTCDate() - 2);

      const dateTo = today.toISOString().slice(0, 10);

      await createEntry(agent, project.id, {
        date: inRangeDate.toISOString().slice(0, 10),
        title: 'In range',
      });

      await createEntry(agent, project.id, {
        date: outofRangeDate.toISOString().slice(0, 10),
        title: 'Out of range',
      });

      const response = await agent.get(
        `/api/export?projectId=${project.id}&format=md&dateFrom=${dateFrom.toISOString().slice(0, 10)}&dateTo=${dateTo}`,
      );

      expect(response.status).toBe(200);
      expect(response.text).toContain('In range');
      expect(response.text).not.toContain('Out of range');
    });

    it('rejects an invalid export format', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.get(`/api/export?projectId=${project.id}&format=pdf`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'format must be csv or md',
      });
    });

    it('rejects a date range where dateFrom is after dateTo', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.get(
        `/api/export?projectId=${project.id}&format=md&dateFrom=2026-09-20&dateTo=2026-09-10`,
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'dateFrom must be before dateTo',
      });
    });
  });
});
