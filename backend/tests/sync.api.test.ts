import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
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

type SyncResult = {
  clientId: string;
  status: 'created' | 'duplicate' | 'failed';
  entryId?: number;
  reason?: string;
};

function statusFor(results: SyncResult[], clientId: string) {
  return results.find((result) => result.clientId === clientId)?.status;
}

async function sync(agent: Agent, entries: Record<string, unknown>[]) {
  const response = await agent.post('/api/entries/sync').send({ entries });
  expect(response.status).toBe(200);
  return response.body.results as SyncResult[];
}

describe('POST /api/entries/sync', () => {
  it('creates a queued entry and writes a CREATE history row', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const clientId = 'a5f0c9e2-1d3b-4c8a-9e77-2b6d4f0a1c33';
    const results = await sync(agent, [
      {
        clientId,
        projectId: project.id,
        content: { [field.name]: '3 hours' },
        date: '2026-10-01T09:00:00.000Z',
        title: 'Library run',
        tagIds: [],
      },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('created');
    expect(typeof results[0].entryId).toBe('number');

    // The entry is a normal entry from here on: it must show up in the
    // timeline with its content intact.
    const list = await agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.status).toBe(200);
    expect(list.body.entries).toHaveLength(1);
    expect(list.body.entries[0].content).toEqual({ [field.name]: '3 hours' });
    expect(list.body.entries[0].title).toBe('Library run');

    const history = await agent.get(`/api/entries/${results[0].entryId}/history`);
    expect(history.status).toBe(200);
    expect(history.body.versions[0].action).toBe('CREATE');
  });

  it('syncing the same batch twice creates each entry once', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const queue = [
      {
        clientId: 'queue-1',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
        date: '2026-10-01T09:00:00.000Z',
      },
      {
        clientId: 'queue-2',
        projectId: project.id,
        content: { [field.name]: '2 hours' },
        date: '2026-10-01T10:00:00.000Z',
      },
    ];

    const first = await sync(agent, queue);
    expect(first.map((result) => result.status)).toEqual(['created', 'created']);

    const second = await sync(agent, queue);
    expect(second.map((result) => result.status)).toEqual(['duplicate', 'duplicate']);

    // The ids are handed back again so the client can match its queue rows to
    // the entries it now owns.
    expect(second[0].entryId).toBe(first[0].entryId);
    expect(second[1].entryId).toBe(first[1].entryId);

    const list = await agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.body.total).toBe(2);

    // A duplicate is not a second write, so no second audit row either.
    const history = await agent.get(`/api/entries/${first[0].entryId}/history`);
    expect(history.body.versions).toHaveLength(1);
  });

  it('reports a duplicate when the same clientId appears twice in one batch', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const results = await sync(agent, [
      {
        clientId: 'same-id',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
      },
      {
        clientId: 'same-id',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
      },
    ]);

    expect(results.map((result) => result.status)).toEqual(['created', 'duplicate']);
  });

  it('creates exactly one entry when the same batch is synced concurrently', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const queue = [
      {
        clientId: 'raced-1',
        projectId: project.id,
        content: { [field.name]: '4 hours' },
      },
      {
        clientId: 'raced-2',
        projectId: project.id,
        content: { [field.name]: '5 hours' },
      },
    ];

    // Two syncs in flight before either has committed. The unique index, not
    // the duplicate check, is what settles this.
    const [left, right] = await Promise.all([sync(agent, queue), sync(agent, queue)]);

    const statuses = [...left, ...right].map((result) => result.status);
    expect(statuses.filter((status) => status === 'created')).toHaveLength(2);
    expect(statuses.filter((status) => status === 'duplicate')).toHaveLength(2);
    expect(statuses.every((status) => status !== 'failed')).toBe(true);

    const list = await agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.body.total).toBe(2);
  });

  it('does not restore an entry that was deleted on the server', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const clientId = 'deleted-elsewhere';
    const created = await sync(agent, [
      { clientId, projectId: project.id, content: { [field.name]: '1 hour' } },
    ]);
    expect(created[0].status).toBe('created');

    const removed = await agent.delete(`/api/entries/${created[0].entryId}`);
    expect(removed.status).toBe(204);

    // A stale copy still in the queue must not bring the entry back.
    const results = await sync(agent, [
      { clientId, projectId: project.id, content: { [field.name]: '1 hour' } },
    ]);

    expect(results[0].status).toBe('duplicate');
    expect(results[0].reason).toContain('deleted');

    const list = await agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.body.total).toBe(0);

    const trash = await agent.get(`/api/projects/${project.id}/trash`);
    expect(trash.body.entries).toHaveLength(1);
  });

  it('fails one entry without losing the rest of the batch', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const results = await sync(agent, [
      {
        clientId: 'good',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
      },
      // Not the caller's project.
      { clientId: 'stolen', projectId: project.id + 9999, content: { [field.name]: 'x' } },
      // Content that does not match the project's fields.
      { clientId: 'wrong-fields', projectId: project.id, content: { nope: 'x' } },
      // A field the project requires, missing.
      { clientId: 'missing-field', projectId: project.id, content: {} },
      // Every value blank.
      { clientId: 'blank', projectId: project.id, content: { [field.name]: '   ' } },
      // Tag belonging to somebody else.
      {
        clientId: 'other-tag',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
        tagIds: [99999],
      },
    ]);

    expect(statusFor(results, 'good')).toBe('created');
    expect(statusFor(results, 'stolen')).toBe('failed');
    expect(statusFor(results, 'wrong-fields')).toBe('failed');
    expect(statusFor(results, 'missing-field')).toBe('failed');
    expect(statusFor(results, 'blank')).toBe('failed');
    expect(statusFor(results, 'other-tag')).toBe('failed');

    expect(results.find((result) => result.clientId === 'stolen')?.reason).toContain(
      'access to this project',
    );
    expect(results.find((result) => result.clientId === 'wrong-fields')?.reason).toContain(
      'Unknown field',
    );
    expect(results.find((result) => result.clientId === 'missing-field')?.reason).toContain(
      'required',
    );
    expect(results.find((result) => result.clientId === 'other-tag')?.reason).toContain('tags');

    // Only the good one landed.
    const list = await agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.body.total).toBe(1);
    expect(list.body.entries[0].content).toEqual({ [field.name]: '1 hour' });
  });

  it('attaches tags the user owns', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });
    const tag = await createTag(agent, 'writing');

    const results = await sync(agent, [
      {
        clientId: 'tagged',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
        tagIds: [tag.id],
      },
    ]);

    expect(results[0].status).toBe('created');

    const list = await agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.body.entries[0].tags).toHaveLength(1);
    expect(list.body.entries[0].tags[0].tag.name).toBe('writing');
  });

  it('rejects a malformed body with 400 rather than per-entry failures', async () => {
    const { agent } = await createAuthenticatedUser();

    const notAnArray = await agent.post('/api/entries/sync').send({ entries: 'nope' });
    expect(notAnArray.status).toBe(400);

    const missing = await agent.post('/api/entries/sync').send({});
    expect(missing.status).toBe(400);
  });

  it('treats an empty queue as a successful no-op', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.post('/api/entries/sync').send({ entries: [] });
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([]);
  });

  it('caps the batch size', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const tooMany = Array.from({ length: 101 }, (_, index) => ({
      clientId: `bulk-${index}`,
      projectId: project.id,
      content: { [field.name]: '1 hour' },
    }));

    const response = await agent.post('/api/entries/sync').send({ entries: tooMany });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('100');
  });

  it('reports unusable entries instead of guessing', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis Research' });

    const results = await sync(agent, [
      { projectId: project.id, content: {} },
      { clientId: '', projectId: project.id, content: {} },
      { clientId: 'no-project', content: {} },
      { clientId: 'bad-project', projectId: 'abc', content: {} },
      { clientId: 'no-content', projectId: project.id },
      { clientId: 'array-content', projectId: project.id, content: [] },
      { clientId: 'bad-date', projectId: project.id, content: {}, date: 'not-a-date' },
      { clientId: 'bad-tags', projectId: project.id, content: {}, tagIds: ['one'] },
      { clientId: 'x'.repeat(200), projectId: project.id, content: {} },
    ]);

    expect(results.every((result) => result.status === 'failed')).toBe(true);

    // An entry with no usable clientId cannot be identified at all, so its
    // result carries an empty one rather than a fabricated id.
    const unidentified = results.filter((result) => result.clientId === '');
    expect(unidentified).toHaveLength(2);
    expect(unidentified.every((result) => result.reason?.includes('clientId'))).toBe(true);

    expect(results.find((result) => result.clientId === 'no-project')?.reason).toContain(
      'projectId',
    );
    expect(results.find((result) => result.clientId === 'bad-project')?.reason).toContain(
      'projectId',
    );
    expect(results.find((result) => result.clientId === 'no-content')?.reason).toContain('content');
    expect(results.find((result) => result.clientId === 'array-content')?.reason).toContain(
      'content',
    );
    expect(results.find((result) => result.clientId === 'bad-date')?.reason).toContain('date');
    expect(results.find((result) => result.clientId === 'bad-tags')?.reason).toContain('tagIds');
    expect(results.find((result) => result.clientId === 'x'.repeat(200))?.reason).toContain('191');
  });

  it('cannot sync into another user project', async () => {
    const owner = await createAuthenticatedUser();
    const project = await createProject(owner.agent, { name: 'Thesis Research' });
    const field = await createFieldDefinition(owner.agent, project.id, {
      name: 'timeSpent',
      fieldType: 'text',
    });

    const intruder = await createAuthenticatedUser();
    const results = await sync(intruder.agent, [
      {
        clientId: 'intruder',
        projectId: project.id,
        content: { [field.name]: '1 hour' },
      },
    ]);

    expect(results[0].status).toBe('failed');

    const list = await owner.agent.get(`/api/entries?projectId=${project.id}`);
    expect(list.body.total).toBe(0);
  });

  it('requires authentication', async () => {
    const client = await getApiClient();
    const response = await client.post('/api/entries/sync').send({ entries: [] });
    expect(response.status).toBe(401);
  });
});
