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

const LAYOUT = [
  { id: 'summary', visible: true, size: 'wide' },
  { id: 'statPanel:12', visible: true, size: 'standard' },
  { id: 'insight', visible: false, size: 'standard' },
];

describe('dashboard layout', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();

    expect((await api.get('/api/dashboard/layout')).status).toBe(401);
    expect((await api.put('/api/dashboard/layout').send({ layout: LAYOUT })).status).toBe(401);
  });

  it('is null until a layout has been saved', async () => {
    const { agent } = await createAuthenticatedUser();

    const res = await agent.get('/api/dashboard/layout');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ layout: null });
  });

  it('saves a layout, including panel widgets, and reads it back', async () => {
    const { agent } = await createAuthenticatedUser();

    const put = await agent.put('/api/dashboard/layout').send({ layout: LAYOUT });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ layout: LAYOUT });

    const get = await agent.get('/api/dashboard/layout');
    expect(get.body).toEqual({ layout: LAYOUT });
  });

  it('drops keys a widget should not have', async () => {
    const { agent } = await createAuthenticatedUser();

    const res = await agent.put('/api/dashboard/layout').send({
      layout: [{ id: 'summary', visible: true, size: 'wide', colour: 'red' }],
    });

    expect(res.body).toEqual({ layout: [{ id: 'summary', visible: true, size: 'wide' }] });
  });

  it('keeps each user’s layout to themselves', async () => {
    const first = await createAuthenticatedUser();
    const second = await createAuthenticatedUser();

    await first.agent.put('/api/dashboard/layout').send({ layout: LAYOUT });

    expect((await second.agent.get('/api/dashboard/layout')).body).toEqual({ layout: null });
  });

  it.each([
    ['not an array', { layout: { summary: true } }, 'layout must be an array'],
    [
      'an invalid id',
      { layout: [{ id: 'statPanel:abc', visible: true, size: 'wide' }] },
      'each widget needs a valid id',
    ],
    [
      'a duplicate id',
      {
        layout: [
          { id: 'summary', visible: true, size: 'wide' },
          { id: 'summary', visible: false, size: 'wide' },
        ],
      },
      'widget summary appears more than once',
    ],
    [
      'a non-boolean visible',
      { layout: [{ id: 'summary', visible: 'yes', size: 'wide' }] },
      'visible must be true or false',
    ],
    [
      'an unknown size',
      { layout: [{ id: 'summary', visible: true, size: 'huge' }] },
      'size must be standard or wide',
    ],
    [
      'too many widgets',
      {
        layout: Array.from({ length: 101 }, (_, i) => ({
          id: `statPanel:${i}`,
          visible: true,
          size: 'standard',
        })),
      },
      'layout can hold at most 100 widgets',
    ],
  ])('rejects %s', async (_label, body, error) => {
    const { agent } = await createAuthenticatedUser();

    const res = await agent.put('/api/dashboard/layout').send(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect((await agent.get('/api/dashboard/layout')).body).toEqual({ layout: null });
  });
});

describe('GET /api/stat-panels', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    expect((await api.get('/api/stat-panels')).status).toBe(401);
  });

  it('lists panels from every project with values, project names and field types', async () => {
    const { agent } = await createAuthenticatedUser();
    const thesis = await createProject(agent, { name: 'Thesis' });
    const gym = await createProject(agent, { name: 'Gym' });
    await createFieldDefinition(agent, thesis.id, { name: 'pages', fieldType: 'number' });
    await createFieldDefinition(agent, gym.id, { name: 'time', fieldType: 'duration' });
    await createEntry(agent, thesis.id, { content: { pages: 30 } });
    await createEntry(agent, thesis.id, { content: { pages: 12 } });

    await agent
      .post(`/api/projects/${thesis.id}/stat-panels`)
      .send({ name: 'Pages read', expression: 'pages', aggregation: 'sum' });
    await agent
      .post(`/api/projects/${gym.id}/stat-panels`)
      .send({ name: 'Training time', expression: 'time', aggregation: 'sum' });

    const res = await agent.get('/api/stat-panels');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const pages = res.body.find((panel: { name: string }) => panel.name === 'Pages read');
    expect(pages).toMatchObject({
      projectId: thesis.id,
      project: { id: thesis.id, name: 'Thesis' },
      fields: [{ name: 'pages', fieldType: 'number' }],
      value: 42,
      sampleCount: 2,
    });
    expect(Array.isArray(pages.series)).toBe(true);
  });

  it('leaves out other users’ panels and panels in archived projects', async () => {
    const owner = await createAuthenticatedUser();
    const other = await createAuthenticatedUser();
    const active = await createProject(owner.agent, { name: 'Active' });
    const archived = await createProject(owner.agent, { name: 'Old' });
    const theirs = await createProject(other.agent, { name: 'Theirs' });
    for (const [agent, project] of [
      [owner.agent, active],
      [owner.agent, archived],
      [other.agent, theirs],
    ] as const) {
      await createFieldDefinition(agent, project.id, { name: 'x', fieldType: 'number' });
      await agent
        .post(`/api/projects/${project.id}/stat-panels`)
        .send({ name: `${project.name} panel`, expression: 'x' });
    }
    await owner.agent.post(`/api/projects/${archived.id}/archive`);

    const res = await owner.agent.get('/api/stat-panels');

    expect(res.body.map((panel: { name: string }) => panel.name)).toEqual(['Active panel']);
  });
});
