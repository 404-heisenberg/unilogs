import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createFieldDefinition,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
  type AuthenticatedUser,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

type Agent = AuthenticatedUser['agent'];

async function titles(agent: Agent, query: Record<string, string | number>) {
  const res = await agent.get('/api/entries').query(query);
  expect(res.status).toBe(200);
  return (res.body.entries as { title: string }[]).map((entry) => entry.title).sort();
}

describe('GET /api/entries field filtering and search', () => {
  let agent: Agent;
  let projectId: number;

  beforeEach(async () => {
    ({ agent } = await createAuthenticatedUser());
    const project = await createProject(agent, { name: 'Thesis' });
    projectId = project.id;
    await createFieldDefinition(agent, projectId, { name: 'Pages', fieldType: 'number' });
    await createFieldDefinition(agent, projectId, { name: 'Time', fieldType: 'duration' });
    await createFieldDefinition(agent, projectId, { name: 'Chapter', fieldType: 'text' });
    await createFieldDefinition(agent, projectId, { name: 'Due', fieldType: 'date' });
    await createFieldDefinition(agent, projectId, { name: 'Done', fieldType: 'boolean' });

    await createEntry(agent, projectId, {
      title: 'Short read',
      content: { Pages: 5, Time: 0.5, Chapter: 'Intro', Due: '2026-09-01', Done: true },
    });
    await createEntry(agent, projectId, {
      title: 'Long read',
      content: { Pages: 40, Time: 3, Chapter: 'Methodology', Due: '2026-09-10', Done: false },
    });
    await createEntry(agent, projectId, {
      title: 'Middle read',
      content: { Pages: 20, Time: 1.5, Chapter: 'Related work', Due: '2026-09-05', Done: true },
    });
  });

  it('filters a number field by range, inclusively', async () => {
    expect(await titles(agent, { projectId, field: 'Pages', min: 20 })).toEqual([
      'Long read',
      'Middle read',
    ]);
    expect(await titles(agent, { projectId, field: 'Pages', min: 5, max: 20 })).toEqual([
      'Middle read',
      'Short read',
    ]);
    expect(await titles(agent, { projectId, field: 'Pages', value: 40 })).toEqual(['Long read']);
  });

  it('filters a duration field in hours', async () => {
    expect(await titles(agent, { projectId, field: 'Time', max: 1.5 })).toEqual([
      'Middle read',
      'Short read',
    ]);
  });

  it('matches a text field case-insensitively, treating % and _ literally', async () => {
    expect(await titles(agent, { projectId, field: 'Chapter', value: 'METHOD' })).toEqual([
      'Long read',
    ]);
    expect(await titles(agent, { projectId, field: 'Chapter', value: '%' })).toEqual([]);
  });

  it('filters a date field by day and by range', async () => {
    expect(await titles(agent, { projectId, field: 'Due', value: '2026-09-05' })).toEqual([
      'Middle read',
    ]);
    expect(
      await titles(agent, { projectId, field: 'Due', min: '2026-09-02', max: '2026-09-10' }),
    ).toEqual(['Long read', 'Middle read']);
  });

  it('filters a toggle field by true or false', async () => {
    expect(await titles(agent, { projectId, field: 'Done', value: 'true' })).toEqual([
      'Middle read',
      'Short read',
    ]);
    expect(await titles(agent, { projectId, field: 'Done', value: 'false' })).toEqual([
      'Long read',
    ]);
  });

  it('combines a field filter with the other filters (AND)', async () => {
    expect(await titles(agent, { projectId, field: 'Done', value: 'true', q: 'middle' })).toEqual([
      'Middle read',
    ]);
  });

  it('pages a field-filtered list and counts only the matches', async () => {
    const res = await agent
      .get('/api/entries')
      .query({ projectId, field: 'Pages', min: 5, limit: 2, page: 2 });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(2);
    expect(res.body.entries).toHaveLength(1);
  });

  it('searches field values with q', async () => {
    expect(await titles(agent, { q: 'related WORK' })).toEqual(['Middle read']);
  });

  it('returns each entry with its project’s field types', async () => {
    const res = await agent.get('/api/entries').query({ projectId, limit: 1 });

    expect(res.body.entries[0].project.fields).toEqual([
      { name: 'Pages', fieldType: 'number' },
      { name: 'Time', fieldType: 'duration' },
      { name: 'Chapter', fieldType: 'text' },
      { name: 'Due', fieldType: 'date' },
      { name: 'Done', fieldType: 'boolean' },
    ]);
  });

  it.each([
    [{ field: 'Pages', min: 1 }, 'field requires projectId'],
    [{ value: 'x' }, 'value, min and max need a field'],
    [{ projectIdFromTest: true, field: 'Pages' }, 'field needs a value, min or max'],
    [
      { projectIdFromTest: true, field: 'Nope', value: 'x' },
      'This project has no field named "Nope"',
    ],
    [{ projectIdFromTest: true, field: 'Pages', min: 'lots' }, 'min must be a number'],
    [
      { projectIdFromTest: true, field: 'Done', value: 'yes' },
      'A toggle field takes value=true or value=false',
    ],
    [{ projectIdFromTest: true, field: 'Due', value: '10/09/2026' }, 'Dates must be YYYY-MM-DD'],
  ])('rejects %o', async (input, error) => {
    const { projectIdFromTest, ...query } = input as Record<string, unknown>;
    const res = await agent
      .get('/api/entries')
      .query({ ...(projectIdFromTest ? { projectId } : {}), ...query });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
  });

  it('never finds another user’s entries through a field filter or search', async () => {
    const other = await createAuthenticatedUser();

    expect(await titles(other.agent, { q: 'methodology' })).toEqual([]);
    const res = await other.agent
      .get('/api/entries')
      .query({ projectId, field: 'Chapter', value: 'Intro' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This project has no field named "Chapter"');
  });
});
