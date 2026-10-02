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

type Agent = Awaited<ReturnType<typeof createAuthenticatedUser>>['agent'];

type Version = {
  auditId: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  modifiedAt: string;
  snapshot: {
    title: string | null;
    body: string | null;
    content: Record<string, unknown>;
    date: string;
    tagIds?: number[];
  } | null;
};

async function getHistory(agent: Agent, id: number) {
  const response = await agent.get(`/api/entries/${id}/history`);
  expect(response.status).toBe(200);
  return response.body.versions as Version[];
}

async function createShareLink(agent: Agent, projectId: number) {
  const response = await agent.post(`/api/projects/${projectId}/share-links`).send({});
  expect(response.status).toBe(201);
  return response.body.token as string;
}

describe('entry history and recovery', () => {
  describe('authentication guard', () => {
    it('rejects unauthenticated history, restore and trash requests', async () => {
      const api = await getApiClient();

      const responses = await Promise.all([
        api.get('/api/entries/1/history'),
        api.post('/api/entries/1/history/1/restore'),
        api.post('/api/entries/1/restore'),
        api.get('/api/projects/1/trash'),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(401);
      }
    }, 30_000);
  });

  describe('soft delete', () => {
    it('hides a deleted entry from every read path', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'duration' });

      const deleted = await createEntry(agent, project.id, {
        title: 'Deleted entry',
        content: { Hours: 4 },
      });
      const kept = await createEntry(agent, project.id, {
        title: 'Kept entry',
        content: { Hours: 1 },
      });

      const deletedResponse = await agent.delete(`/api/entries/${deleted.id}`);
      expect(deletedResponse.status).toBe(204);

      // Timeline.
      const list = await agent.get('/api/entries');
      expect(list.body.entries.map((entry: { id: number }) => entry.id)).toEqual([kept.id]);

      // Single reads are a 404, which is also why a second delete is a 404.
      expect((await agent.get(`/api/entries/${deleted.id}`)).status).toBe(404);
      expect((await agent.delete(`/api/entries/${deleted.id}`)).status).toBe(404);
      expect((await agent.put(`/api/entries/${deleted.id}`).send({ title: 'Nope' })).status).toBe(
        404,
      );

      // Project summary - a nested relation load, which the extension cannot see.
      const summary = await agent.get(`/api/projects/${project.id}/summary`);
      expect(summary.status).toBe(200);
      expect(summary.body.entryCount).toBe(1);
      expect(summary.body.trackedTimeMinutes).toBe(60);

      // Dashboard totals and field insights.
      const stats = await agent.get('/api/stats');
      expect(stats.body.totalHours).toBe(1);

      const insights = await agent.get(`/api/stats/fields/${project.id}`);
      expect(insights.body.fields[0].valueMinutes).toBe(60);

      // Export.
      const csv = await agent.get(`/api/export?projectId=${project.id}&format=csv`);
      expect(csv.status).toBe(200);
      expect(csv.text).toContain('Kept entry');
      expect(csv.text).not.toContain('Deleted entry');

      // Shared report.
      const token = await createShareLink(agent, project.id);
      const api = await getApiClient();
      const shared = await api.get(`/share/${token}`);
      expect(shared.status).toBe(200);
      expect((shared.body.entries as { title: string }[]).map((entry) => entry.title)).toEqual([
        'Kept entry',
      ]);
    }, 60_000);

    it('keeps a deleted entry out of the frequency counts', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const today = new Date().toISOString().slice(0, 10);
      const deleted = await createEntry(agent, project.id, { date: today, title: 'Gone' });

      const before = await agent.get('/api/stats/frequency');
      const weekBefore = before.body.weekly.find(
        (week: { weekStart: string }) => week.weekStart <= today,
      );

      await agent.delete(`/api/entries/${deleted.id}`);

      const after = await agent.get('/api/stats/frequency');
      const weekAfter = after.body.weekly.find(
        (week: { weekStart: string }) => week.weekStart <= today,
      );

      expect(weekAfter.count).toBe(weekBefore.count - 1);
    }, 60_000);

    it("does not shorten the streak when today's only entry is deleted", async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);

      const today = await createEntry(agent, project.id, { title: 'Today' });
      expect((await agent.get('/api/stats/streak')).body.streak).toBeGreaterThanOrEqual(1);

      await agent.delete(`/api/entries/${today.id}`);

      expect((await agent.get('/api/stats/streak')).body.streak).toBe(0);
    }, 60_000);
  });

  describe('history', () => {
    it('lists CREATE and every UPDATE, newest first', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const tag = await createTag(agent, 'thesis');
      const entry = await createEntry(agent, project.id, {
        title: 'First title',
        body: 'First body',
        tagIds: [tag.id],
      });

      await agent.put(`/api/entries/${entry.id}`).send({ title: 'Second title' });
      await agent.put(`/api/entries/${entry.id}`).send({ title: 'Third title' });

      const versions = await getHistory(agent, entry.id);

      expect(versions).toHaveLength(3);
      expect(versions.map((version) => version.action)).toEqual(['UPDATE', 'UPDATE', 'CREATE']);
      expect(versions.map((version) => version.snapshot?.title)).toEqual([
        'Third title',
        'Second title',
        'First title',
      ]);
    });

    it('stores trimmed snapshots rather than the whole entry row', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      await createFieldDefinition(agent, project.id, { name: 'Hours', fieldType: 'number' });
      const tag = await createTag(agent, 'thesis');
      const entry = await createEntry(agent, project.id, {
        title: 'Trimmed',
        body: 'Body text',
        content: { Hours: 3 },
        tagIds: [tag.id],
      });

      const [version] = await getHistory(agent, entry.id);

      // The old snapshot embedded the entry *and* its project, so every
      // version of every entry carried a copy of the project's fields.
      expect(Object.keys(version.snapshot!).sort()).toEqual([
        'body',
        'content',
        'date',
        'tagIds',
        'title',
      ]);
      expect(version.snapshot!.content).toEqual({ Hours: 3 });
      expect(version.snapshot!.tagIds).toEqual([tag.id]);
    });

    it('records a DELETE row without losing earlier versions', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const entry = await createEntry(agent, project.id, { title: 'Doomed' });

      await agent.delete(`/api/entries/${entry.id}`);

      // Read through the unfiltered client: the history of a deleted entry is
      // what the trash needs in order to show what it was.
      const { prismaWithDeleted } = await import('../src/lib/prisma.js');
      const rows = await prismaWithDeleted.auditLog.findMany({ where: { entryId: entry.id } });
      expect(rows.map((row) => row.action).sort()).toEqual(['CREATE', 'DELETE']);

      // The user-facing route is owner-scoped and hides deleted entries.
      expect((await agent.get(`/api/entries/${entry.id}/history`)).status).toBe(404);
    });

    it("does not expose another user's entry history", async () => {
      const owner = await createAuthenticatedUser();
      const project = await createProject(owner.agent);
      const entry = await createEntry(owner.agent, project.id, { title: 'Private' });

      const intruder = await createAuthenticatedUser();
      expect((await intruder.agent.get(`/api/entries/${entry.id}/history`)).status).toBe(404);
    }, 30_000);
  });

  describe('restoring a version', () => {
    it('applies the old version and appends a history row instead of rewriting', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const entry = await createEntry(agent, project.id, {
        title: 'Original',
        body: 'Original body',
      });

      await agent.put(`/api/entries/${entry.id}`).send({ title: 'Edited', body: 'Edited body' });

      const beforeRestore = await getHistory(agent, entry.id);
      const originalVersion = beforeRestore.find((version) => version.action === 'CREATE')!;

      const restore = await agent.post(
        `/api/entries/${entry.id}/history/${originalVersion.auditId}/restore`,
      );
      expect(restore.status).toBe(200);

      const read = await agent.get(`/api/entries/${entry.id}`);
      expect(read.body.title).toBe('Original');
      expect(read.body.body).toBe('Original body');

      // Three rows now: nothing was rewritten, a fourth was added.
      const afterRestore = await getHistory(agent, entry.id);
      expect(afterRestore).toHaveLength(beforeRestore.length + 1);
      expect(afterRestore[0].action).toBe('UPDATE');
      expect(afterRestore[0].snapshot?.title).toBe('Original');
      // The row it replaced is still on the record.
      expect(afterRestore.some((version) => version.snapshot?.title === 'Edited')).toBe(true);
    });

    it("restores the version's tags", async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const thesis = await createTag(agent, 'thesis');
      const reading = await createTag(agent, 'reading');
      const entry = await createEntry(agent, project.id, { tagIds: [thesis.id] });

      await agent.put(`/api/entries/${entry.id}`).send({ tagIds: [reading.id] });

      // The CREATE version, not the newest one: the newest version's snapshot
      // *is* the current state, so restoring it would be a no-op.
      const versions = await getHistory(agent, entry.id);
      const created = versions.find((version) => version.action === 'CREATE')!;
      expect(created.snapshot!.tagIds).toEqual([thesis.id]);

      const restore = await agent.post(
        `/api/entries/${entry.id}/history/${created.auditId}/restore`,
      );
      expect(restore.status).toBe(200);
      expect(restore.body.tagsChanged).toBe(true);

      const read = await agent.get(`/api/entries/${entry.id}`);
      expect(read.body.tags.map((tag: { tagId: number }) => tag.tagId)).toEqual([thesis.id]);
    });

    it('404s on an unknown version', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const entry = await createEntry(agent, project.id);

      const restore = await agent.post(`/api/entries/${entry.id}/history/999999/restore`);
      expect(restore.status).toBe(404);
    });

    it('400s when the version no longer matches the project fields', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const field = await createFieldDefinition(agent, project.id, {
        name: 'Hours',
        fieldType: 'number',
      });
      const entry = await createEntry(agent, project.id, { content: { Hours: 2 } });

      const [created] = await getHistory(agent, entry.id);

      // Renaming the field leaves the old version referring to a name the
      // project no longer has, so restoring it would produce an entry the
      // project cannot display.
      const renamed = await agent.put(`/api/field-definitions/${field.id}`).send({ name: 'Time' });
      expect(renamed.status).toBe(200);

      const restore = await agent.post(
        `/api/entries/${entry.id}/history/${created.auditId}/restore`,
      );
      expect(restore.status).toBe(400);
      expect(restore.body.errors.length).toBeGreaterThan(0);
    }, 30_000);
  });

  describe('trash', () => {
    it('lists deleted entries newest-deleted first', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const first = await createEntry(agent, project.id, { title: 'First deleted' });
      const second = await createEntry(agent, project.id, { title: 'Second deleted' });
      const kept = await createEntry(agent, project.id, { title: 'Still here' });

      await agent.delete(`/api/entries/${first.id}`);
      await agent.delete(`/api/entries/${second.id}`);

      const trash = await agent.get(`/api/projects/${project.id}/trash`);
      expect(trash.status).toBe(200);
      expect(trash.body.project.id).toBe(project.id);
      expect(trash.body.entries.map((entry: { id: number }) => entry.id)).toEqual([
        second.id,
        first.id,
      ]);
      expect(trash.body.entries[0].title).toBe('Second deleted');
      expect(trash.body.entries[0].deletedAt).toEqual(expect.any(String));
      expect(trash.body.entries.map((entry: { id: number }) => entry.id)).not.toContain(kept.id);
    });

    it('404s for a project the caller does not own', async () => {
      const owner = await createAuthenticatedUser();
      const project = await createProject(owner.agent);

      const intruder = await createAuthenticatedUser();
      expect((await intruder.agent.get(`/api/projects/${project.id}/trash`)).status).toBe(404);
    }, 30_000);

    it('restores a deleted entry with its tags intact', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const tag = await createTag(agent, 'thesis');
      const entry = await createEntry(agent, project.id, {
        title: 'Back from the trash',
        tagIds: [tag.id],
      });

      await agent.delete(`/api/entries/${entry.id}`);

      const restore = await agent.post(`/api/entries/${entry.id}/restore`);
      expect(restore.status).toBe(200);

      const list = await agent.get('/api/entries');
      expect(list.body.entries.map((row: { id: number }) => row.id)).toEqual([entry.id]);

      const read = await agent.get(`/api/entries/${entry.id}`);
      expect(read.body.tags.map((entryTag: { tagId: number }) => entryTag.tagId)).toEqual([tag.id]);

      const trash = await agent.get(`/api/projects/${project.id}/trash`);
      expect(trash.body.entries).toEqual([]);
    });

    it('409s when the entry is not deleted', async () => {
      const { agent } = await createAuthenticatedUser();
      const project = await createProject(agent);
      const entry = await createEntry(agent, project.id);

      const restore = await agent.post(`/api/entries/${entry.id}/restore`);
      expect(restore.status).toBe(409);
    });

    it("does not restore another user's deleted entry", async () => {
      const owner = await createAuthenticatedUser();
      const project = await createProject(owner.agent);
      const entry = await createEntry(owner.agent, project.id);
      await owner.agent.delete(`/api/entries/${entry.id}`);

      const intruder = await createAuthenticatedUser();
      expect((await intruder.agent.post(`/api/entries/${entry.id}/restore`)).status).toBe(404);

      const stillDeleted = await owner.agent.get(`/api/projects/${project.id}/trash`);
      expect(stillDeleted.body.entries).toHaveLength(1);
    }, 30_000);
  });
});
