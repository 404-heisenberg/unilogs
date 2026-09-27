import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createTag,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('tags API', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();

    const responses = await Promise.all([
      api.get('/api/tags'),
      api.post('/api/tags').send({ name: 'Programming' }),
      api.patch('/api/tags/1').send({ name: 'Updated' }),
      api.delete('/api/tags/1'),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });

  it('creates a tag', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.post('/api/tags').send({
      name: 'Programming',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      name: 'Programming',
      usageCount: 0,
    });
  });

  it('lists the user tags with usage counts', async () => {
    const { agent } = await createAuthenticatedUser();

    const first = await createTag(agent, 'Programming');
    const second = await createTag(agent, 'Testing');

    const response = await agent.get('/api/tags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: first.id,
        name: 'Programming',
        usageCount: 0,
      },
      {
        id: second.id,
        name: 'Testing',
        usageCount: 0,
      },
    ]);
  });

  it('updates a tag', async () => {
    const { agent } = await createAuthenticatedUser();
    const tag = await createTag(agent, 'Old name');

    const response = await agent.patch(`/api/tags/${tag.id}`).send({
      name: 'New Name',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: tag.id,
      name: 'New Name',
      usageCount: 0,
    });
  });

  it('deletes a tag', async () => {
    const { agent } = await createAuthenticatedUser();
    const tag = await createTag(agent, 'Test Tag');
    const response = await agent.delete(`/api/tags/${tag.id}`);

    expect(response.status).toBe(204);
    const tags = await agent.get('/api/tags');
    expect(tags.body).toEqual([]);
  });

  it('rejects a duplicate tag name', async () => {
    const { agent } = await createAuthenticatedUser();

    await createTag(agent, 'Programming');

    const response = await agent.post('/api/tags').send({
      name: 'Programming',
    });

    expect(response.status).toBe(409);
  });

  it('rejects an empty tag name', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.post('/api/tags').send({
      name: ' ',
    });

    expect(response.status).toBe(400);
  });

  it("rejects access to another user's tag", async () => {
    const owner = await createAuthenticatedUser();
    const other = await createAuthenticatedUser();

    const tag = await createTag(owner.agent, 'Private');

    const update = await other.agent.patch(`/api/tags/${tag.id}`).send({
      name: 'Changed',
    });

    const deletion = await other.agent.delete(`/api/tags/${tag.id}`);

    expect(update.status).toBe(403);
    expect(deletion.status).toBe(403);
  });

  it('rejects renaming a tag to an existing name', async () => {
    const { agent } = await createAuthenticatedUser();

    await createTag(agent, 'Programming');
    const tag = await createTag(agent, 'Testing');

    const response = await agent.patch(`/api/tags/${tag.id}`).send({
      name: 'Programming',
    });

    expect(response.status).toBe(409);
  });
});
