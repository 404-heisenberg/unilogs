import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
  createAuthenticatedUser,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

describe('reminder settings', () => {
  it('defaults the global reminder kill switch to on', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.get('/api/settings');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ remindersEnabled: true });
  });

  it('persists the global kill switch', async () => {
    const { agent } = await createAuthenticatedUser();

    const update = await agent.patch('/api/settings').send({ remindersEnabled: false });
    const read = await agent.get('/api/settings');

    expect(update.status).toBe(200);
    expect(update.body).toEqual({ remindersEnabled: false });
    expect(read.body).toEqual({ remindersEnabled: false });
  });

  it('rejects a non-boolean kill switch value', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.patch('/api/settings').send({ remindersEnabled: 'yes' });

    expect(response.status).toBe(400);
  });

  it('rejects unauthenticated settings requests', async () => {
    const api = await getApiClient();

    const responses = await Promise.all([
      api.get('/api/settings'),
      api.patch('/api/settings').send({ remindersEnabled: false }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
    }
  });
});

describe('per-project reminder frequency', () => {
  it('defaults a new project to WEEKLY', async () => {
    const { agent } = await createAuthenticatedUser();

    const project = await createProject(agent);

    expect(project.reminderFrequency).toBe('WEEKLY');
  });

  it('updates and returns the project frequency', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const update = await agent
      .patch(`/api/projects/${project.id}`)
      .send({ reminderFrequency: 'OFF' });
    const read = await agent.get(`/api/projects/${project.id}`);

    expect(update.status).toBe(200);
    expect(update.body.reminderFrequency).toBe('OFF');
    expect(read.body.reminderFrequency).toBe('OFF');
  });

  it('rejects an unknown frequency', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);

    const response = await agent
      .patch(`/api/projects/${project.id}`)
      .send({ reminderFrequency: 'HOURLY' });

    expect(response.status).toBe(400);
  });
});
