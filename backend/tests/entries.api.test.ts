import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createFieldDefinition,
  createProject,
  createTag,
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
      expect(response.body.entries).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: entry.id })]),
      );
      expect(response.body.total).toBeGreaterThanOrEqual(1);
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
  describe('title and body (A-02)', () => {
    it('creates an entry with title and Markdown body', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Fixed the login bug',
        body: '## What I did\n\n- Wrote unit tests\n- Fixed the bug',
        content: {},
        date: '2025-09-01',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          title: 'Fixed the login bug',
          body: '## What I did\n\n- Wrote unit tests\n- Fixed the bug',
          content: {},
        }),
      );
    });

    it('creates an entry with only a title', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Title only',
        content: {},
        date: '2025-09-01',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          title: 'Title only',
          body: null,
        }),
      );
    });

    it('creates an entry with only a body', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        body: 'Just a body, no title',
        content: {},
        date: '2025-09-01',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          title: null,
          body: 'Just a body, no title',
        }),
      );
    });

    it('creates an entry with only content (no title or body)', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        content: { Hours: 2 },
        date: '2025-09-01',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        expect.objectContaining({
          title: null,
          body: null,
          content: { Hours: 2 },
        }),
      );
    });

    it('rejects a wholly empty entry (no title, body, or content values)', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const response = await agent.post('/api/entries').send({
        projectId: project.id,
        title: '   ',
        body: '   ',
        content: {},
        date: '2025-09-01',
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.any(Array));
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('round-trips title and body through GET /api/entries/:id', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const created = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Round trip',
        body: 'Body content here',
        content: {},
        date: '2025-09-01',
      });

      const read = await agent.get(`/api/entries/${created.body.id}`);
      expect(read.status).toBe(200);
      expect(read.body).toEqual(
        expect.objectContaining({
          title: 'Round trip',
          body: 'Body content here',
        }),
      );
    });

    it('includes title and body in the list endpoint', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const created = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Listed entry',
        body: 'Body for list',
        content: {},
        date: '2025-09-01',
      });

      const list = await agent.get('/api/entries');
      expect(list.status).toBe(200);
      expect(list.body.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: created.body.id,
            title: 'Listed entry',
            body: 'Body for list',
          }),
        ]),
      );
    });

    it('updates only the title without clobbering body or content', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });

      const created = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Original title',
        body: 'Original body',
        content: { Hours: 3 },
        date: '2025-09-01',
      });

      const updated = await agent.put(`/api/entries/${created.body.id}`).send({
        title: 'Updated title',
      });

      expect(updated.status).toBe(200);
      expect(updated.body).toEqual(
        expect.objectContaining({
          title: 'Updated title',
          body: 'Original body',
          content: { Hours: 3 },
        }),
      );
    });

    it('updates only the body without clobbering title or content', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const created = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Keep this title',
        body: 'Old body',
        content: {},
        date: '2025-09-01',
      });

      const updated = await agent.put(`/api/entries/${created.body.id}`).send({
        body: 'New body content',
      });

      expect(updated.status).toBe(200);
      expect(updated.body).toEqual(
        expect.objectContaining({
          title: 'Keep this title',
          body: 'New body content',
        }),
      );
    });

    it('rejects a PUT that would leave the entry wholly empty', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const created = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Has a title',
        content: {},
        date: '2025-09-01',
      });

      const response = await agent.put(`/api/entries/${created.body.id}`).send({
        title: '   ',
        body: '   ',
      });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(expect.any(Array));
      expect(response.body.errors.length).toBeGreaterThan(0);
    });
  });
  describe('search, filters, and pagination (A-03)', () => {
    it('filters by projectId', async () => {
      const { agent } = await createAuthenticatedUser();
      const p1 = await createProject(agent);
      const p2 = await createProject(agent);
      const e1 = await createEntry(agent, p1.id, { title: 'In project 1' });
      await createEntry(agent, p2.id, { title: 'In project 2' });

      const response = await agent.get(`/api/entries?projectId=${p1.id}`);
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
      expect(response.body.entries[0].id).toBe(e1.id);
      expect(response.body.total).toBe(1);
    });

    it('filters by dateFrom and dateTo (inclusive)', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, { date: '2025-09-01' });
      const mid = await createEntry(agent, project.id, { date: '2025-09-05' });
      await createEntry(agent, project.id, { date: '2025-09-10' });

      const response = await agent.get('/api/entries?dateFrom=2025-09-05&dateTo=2025-09-05');
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
      expect(response.body.entries[0].id).toBe(mid.id);
    });

    it('filters by tagIds (entry must have ALL tags)', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const t1 = await createTag(agent, 'research');
      const t2 = await createTag(agent, 'study');

      const both = await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Both tags',
        content: {},
        tagIds: [t1.id, t2.id],
      });
      await agent.post('/api/entries').send({
        projectId: project.id,
        title: 'Only one',
        content: {},
        tagIds: [t1.id],
      });

      const response = await agent.get(`/api/entries?tagIds=${t1.id},${t2.id}`);
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
      expect(response.body.entries[0].id).toBe(both.body.id);
    });

    it('searches by title (case-insensitive)', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, { title: 'Fixed the INTERFERENCE bug' });
      await createEntry(agent, project.id, { title: 'Unrelated' });

      const response = await agent.get('/api/entries?q=interference');
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
    });

    it('searches by body', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, {
        title: 'A',
        body: 'This body mentions refactoring',
      });
      await createEntry(agent, project.id, { title: 'B', body: 'Something else' });

      const response = await agent.get('/api/entries?q=refactoring');
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
    });

    it('searches by project name', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await agent.post('/api/projects').send({ name: 'Quantum Physics' });
      await createEntry(agent, project.body.id, { title: 'A' });
      const other = await createProject(agent);
      await createEntry(agent, other.id, { title: 'B' });

      const response = await agent.get('/api/entries?q=quantum');
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
      expect(response.body.entries[0].project.name).toBe('Quantum Physics');
    });

    it('returns empty results for no matches', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, { title: 'Something' });

      const response = await agent.get('/api/entries?q=zzzznotfoundzzzz');
      expect(response.status).toBe(200);
      expect(response.body.entries).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('combines search + filters', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createEntry(agent, project.id, {
        title: 'Interference notes',
        date: '2025-09-05',
      });
      await createEntry(agent, project.id, {
        title: 'Interference older',
        date: '2025-08-01',
      });

      const response = await agent.get(
        `/api/entries?q=interference&projectId=${project.id}&dateFrom=2025-09-01`,
      );
      expect(response.status).toBe(200);
      expect(response.body.entries.length).toBe(1);
    });

    it('paginates and returns a stable total', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      for (let i = 0; i < 5; i++) {
        await createEntry(agent, project.id, {
          title: `Entry ${i}`,
          date: `2025-09-0${i + 1}`,
        });
      }

      const p1 = await agent.get('/api/entries?limit=2&page=1');
      const p2 = await agent.get('/api/entries?limit=2&page=2');

      expect(p1.body.entries.length).toBe(2);
      expect(p2.body.entries.length).toBe(2);
      expect(p1.body.total).toBe(5);
      expect(p2.body.total).toBe(5);

      const ids1 = p1.body.entries.map((e: { id: number }) => e.id);
      const ids2 = p2.body.entries.map((e: { id: number }) => e.id);
      expect(ids1.filter((id: number) => ids2.includes(id))).toEqual([]);
    });

    it('caps limit at 100', async () => {
      const { agent } = await createAuthenticatedUser();
      const response = await agent.get('/api/entries?limit=9999');
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100);
    });

    it('rejects invalid pagination input', async () => {
      const { agent } = await createAuthenticatedUser();
      const r1 = await agent.get('/api/entries?page=0');
      const r2 = await agent.get('/api/entries?limit=-5');
      expect(r1.status).toBe(400);
      expect(r2.status).toBe(400);
    });

    it('does not leak entries across users when querying a foreign projectId', async () => {
      const owner = await createAuthenticatedUser();
      const other = await createAuthenticatedUser();
      const project = await createProject(owner.agent);
      await createEntry(owner.agent, project.id, { title: 'Private' });

      const response = await other.agent.get(`/api/entries?projectId=${project.id}`);
      expect(response.status).toBe(200);
      expect(response.body.entries).toEqual([]);
      expect(response.body.total).toBe(0);
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
