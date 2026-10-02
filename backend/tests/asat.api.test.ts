import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createProject,
  createTag,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

type Agent = Awaited<ReturnType<typeof createAuthenticatedUser>>['agent'];

type AsAtEntry = {
  id: number;
  title: string | null;
  body: string | null;
  content: Record<string, unknown>;
  date: string;
  project: { id: number; name: string };
  tags: { tagId: number; tag: { id: number; name: string } }[];
};

/**
 * The as-at view reads `AuditLog.modifiedAt` and `Entry.createdAt`, and both
 * default to `now()`. Both have to be moved into the past for a test to
 * describe a moment in September, otherwise every row looks newer than the
 * cutoff and the view is correctly empty.
 */
async function backdate(entryId: number, iso: string) {
  const { prismaWithDeleted } = await import('../src/lib/prisma.js');

  await prismaWithDeleted.entry.update({
    where: { id: entryId },
    data: { createdAt: new Date(iso) },
  });

  // The CREATE row is stamped with the same instant the entry was created.
  await prismaWithDeleted.auditLog.updateMany({
    where: { entryId, action: 'CREATE' },
    data: { modifiedAt: new Date(iso) },
  });
}

async function backdateAudit(entryId: number, action: 'CREATE' | 'UPDATE' | 'DELETE', iso: string) {
  const { prismaWithDeleted } = await import('../src/lib/prisma.js');
  await prismaWithDeleted.auditLog.updateMany({
    where: { entryId, action },
    data: { modifiedAt: new Date(iso) },
  });
}

async function asAt(agent: Agent, query: string) {
  const response = await agent.get(`/api/entries/as-at?${query}`);
  expect(response.status).toBe(200);
  return response.body as { entries: AsAtEntry[]; total: number; date: string };
}

async function createBackdatedEntry(
  agent: Agent,
  projectId: number,
  createdAt: string,
  input: { title?: string; body?: string; content?: Record<string, unknown> } = {},
) {
  const entry = await createEntry(agent, projectId, {
    title: 'Draft intro pipeline',
    body: 'first version',
    content: { Hours: 2 },
    ...input,
  });
  await backdate(entry.id, createdAt);
  return entry;
}

describe('GET /api/entries/as-at', () => {
  it('shows the version an entry held on the chosen date', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    const entry = await createBackdatedEntry(agent, project.id, '2026-09-07T09:00:00.000Z', {
      body: 'first version',
    });

    const edited = await agent.put(`/api/entries/${entry.id}`).send({ body: 'second version' });
    expect(edited.status).toBe(200);
    await backdateAudit(entry.id, 'UPDATE', '2026-09-10T09:00:00.000Z');

    const before = await asAt(agent, 'date=2026-09-08');
    expect(before.total).toBe(1);
    expect(before.entries[0].body).toBe('first version');

    const after = await asAt(agent, 'date=2026-09-11');
    expect(after.entries[0].body).toBe('second version');
  });

  it('still shows an entry that was deleted after the chosen date', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    const entry = await createBackdatedEntry(agent, project.id, '2026-09-07T09:00:00.000Z');

    const removed = await agent.delete(`/api/entries/${entry.id}`);
    expect(removed.status).toBe(204);
    await backdateAudit(entry.id, 'DELETE', '2026-09-10T09:00:00.000Z');

    const before = await asAt(agent, 'date=2026-09-08');
    expect(before.total).toBe(1);
    expect(before.entries[0].id).toBe(entry.id);
    expect(before.entries[0].body).toBe('first version');

    // Once the deletion is in the past too, it is gone.
    const after = await asAt(agent, 'date=2026-09-11');
    expect(after.total).toBe(0);
  });

  it('excludes an entry deleted on or before the chosen date', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    const entry = await createBackdatedEntry(agent, project.id, '2026-09-02T09:00:00.000Z');
    await agent.delete(`/api/entries/${entry.id}`);
    await backdateAudit(entry.id, 'DELETE', '2026-09-05T09:00:00.000Z');

    const view = await asAt(agent, 'date=2026-09-08');
    expect(view.total).toBe(0);
  });

  it('excludes an entry created after the chosen date', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    await createBackdatedEntry(agent, project.id, '2026-09-10T09:00:00.000Z');

    const before = await asAt(agent, 'date=2026-09-08');
    expect(before.total).toBe(0);

    const after = await asAt(agent, 'date=2026-09-11');
    expect(after.total).toBe(1);
  });

  it('brings an entry back for a date after it was restored', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    const entry = await createBackdatedEntry(agent, project.id, '2026-09-02T09:00:00.000Z');

    await agent.delete(`/api/entries/${entry.id}`);
    await backdateAudit(entry.id, 'DELETE', '2026-09-05T09:00:00.000Z');

    const restored = await agent.post(`/api/entries/${entry.id}/restore`);
    expect(restored.status).toBe(200);
    await backdateAudit(entry.id, 'UPDATE', '2026-09-07T09:00:00.000Z');

    // Between the deletion and the restore it was not there.
    expect((await asAt(agent, 'date=2026-09-06')).total).toBe(0);
    // After the restore it is.
    expect((await asAt(agent, 'date=2026-09-08')).total).toBe(1);
  });

  it('reads a whole day, so late-evening entries count', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    await createBackdatedEntry(agent, project.id, '2026-09-08T23:30:00.000Z');

    // "What did the logbook say on the 8th" means everything logged that day,
    // not the state at midnight going into it.
    expect((await asAt(agent, 'date=2026-09-08')).total).toBe(1);
    expect((await asAt(agent, 'date=2026-09-07')).total).toBe(0);
  });

  it('returns entries newest first', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    await createBackdatedEntry(agent, project.id, '2026-09-03T09:00:00.000Z', {
      body: 'older',
    });
    await createBackdatedEntry(agent, project.id, '2026-09-06T09:00:00.000Z', {
      body: 'newer',
    });

    const view = await asAt(agent, 'date=2026-09-08');
    expect(view.entries.map((entry) => entry.body)).toEqual(['newer', 'older']);
  });

  it('resolves tags by name, as the live timeline does', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const tag = await createTag(agent, 'writing');

    const entry = await createBackdatedEntry(agent, project.id, '2026-09-07T09:00:00.000Z', {
      content: { Hours: 2 },
    });

    const tagged = await agent.put(`/api/entries/${entry.id}`).send({ tagIds: [tag.id] });
    expect(tagged.status).toBe(200);
    await backdateAudit(entry.id, 'UPDATE', '2026-09-09T09:00:00.000Z');

    // Before the tag was added the snapshot has no tagIds, so no tags.
    const before = await asAt(agent, 'date=2026-09-08');
    expect(before.entries[0].tags).toEqual([]);

    const after = await asAt(agent, 'date=2026-09-10');
    expect(after.entries[0].tags).toHaveLength(1);
    expect(after.entries[0].tags[0].tag.name).toBe('writing');
  });

  it('includes the project so the timeline can group by it', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    await createBackdatedEntry(agent, project.id, '2026-09-07T09:00:00.000Z');

    const view = await asAt(agent, 'date=2026-09-08');
    expect(view.entries[0].project).toEqual({ id: project.id, name: 'Thesis Research' });
  });

  it('filters to one project', async () => {
    const { agent } = await createAuthenticatedUser();
    const research = await createProject(agent, { name: 'Thesis Research' });
    const reading = await createProject(agent, { name: 'Reading List' });

    await createBackdatedEntry(agent, research.id, '2026-09-07T09:00:00.000Z');
    await createBackdatedEntry(agent, reading.id, '2026-09-07T09:00:00.000Z');

    const view = await asAt(agent, `date=2026-09-08&projectId=${research.id}`);
    expect(view.total).toBe(1);
    expect(view.entries[0].project.id).toBe(research.id);
  });

  it('excludes another user entries', async () => {
    const owner = await createAuthenticatedUser();
    const project = await createProject(owner.agent, { name: 'Thesis Research' });
    await createBackdatedEntry(owner.agent, project.id, '2026-09-07T09:00:00.000Z');

    const intruder = await createAuthenticatedUser();
    const view = await asAt(intruder.agent, 'date=2026-09-08');
    expect(view.total).toBe(0);

    // Asking for someone else's project id is empty, not a leak.
    const byId = await asAt(intruder.agent, `date=2026-09-08&projectId=${project.id}`);
    expect(byId.total).toBe(0);
  });

  it('excludes entries in an archived project', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    await createBackdatedEntry(agent, project.id, '2026-09-07T09:00:00.000Z');

    expect((await asAt(agent, 'date=2026-09-08')).total).toBe(1);

    const archived = await agent.post(`/api/projects/${project.id}/archive`);
    expect(archived.status).toBe(200);

    expect((await asAt(agent, 'date=2026-09-08')).total).toBe(0);
  });

  it('rejects a missing or malformed date', async () => {
    const { agent } = await createAuthenticatedUser();

    expect((await agent.get('/api/entries/as-at')).status).toBe(400);
    expect((await agent.get('/api/entries/as-at?date=')).status).toBe(400);
    expect((await agent.get('/api/entries/as-at?date=08-09-2026')).status).toBe(400);
    expect((await agent.get('/api/entries/as-at?date=2026-9-8')).status).toBe(400);
    expect((await agent.get('/api/entries/as-at?date=2026-13-01')).status).toBe(400);
    expect((await agent.get('/api/entries/as-at?date=yesterday')).status).toBe(400);
  });

  it('rejects a malformed projectId', async () => {
    const { agent } = await createAuthenticatedUser();
    const response = await agent.get('/api/entries/as-at?date=2026-09-08&projectId=abc');
    expect(response.status).toBe(400);
  });

  it('echoes the requested day back', async () => {
    const { agent } = await createAuthenticatedUser();
    const view = await asAt(agent, 'date=2026-09-08');
    expect(view.date).toBe('2026-09-08');
  });

  it('is read only - it cannot be confused with an entry id', async () => {
    const { agent } = await createAuthenticatedUser();
    // `as-at` is a literal path segment. If it were matched by `GET /:id` the
    // response would be a 400 about a bad id rather than a reconstruction.
    const response = await agent.get('/api/entries/as-at?date=2026-09-08');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('entries');
  });

  it('requires authentication', async () => {
    const client = await getApiClient();
    const response = await client.get('/api/entries/as-at?date=2026-09-08');
    expect(response.status).toBe(401);
  });
});
