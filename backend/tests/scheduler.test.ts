import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
} from './helpers/api.js';

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn<(to: string, subject: string, html: string) => Promise<boolean>>(
    async () => true,
  ),
}));

vi.mock('../src/services/email-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/email-service.js')>();
  return { ...actual, sendEmail: sendEmailMock };
});

import { runSweep } from '../src/scheduler.js';

afterEach(async () => {
  sendEmailMock.mockClear();
  await deleteTestUsers();
});
afterAll(disconnectTestDatabase);

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// runSweep is global, so assert on this test's own user rather than totals.
function sendsTo(email: string): number {
  return sendEmailMock.mock.calls.filter((call) => call[0] === email).length;
}

describe('runSweep', () => {
  it('notifies a WEEKLY project untouched for 8 days exactly once', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createEntry(agent, project.id, { date: daysAgo(8) });
    sendEmailMock.mockClear();

    await runSweep();
    await runSweep();
    const feed = await agent.get('/api/notifications');

    expect(feed.body.notifications).toHaveLength(1);
    expect(feed.body.unreadCount).toBe(1);
    expect(sendsTo(email)).toBe(1);
  });

  it('leaves a recently active project alone', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createEntry(agent, project.id, { date: daysAgo(1) });
    sendEmailMock.mockClear();

    await runSweep();

    expect(sendsTo(email)).toBe(0);
  });

  it('skips OFF and archived projects', async () => {
    const { agent, email } = await createAuthenticatedUser();

    const off = await createProject(agent);
    await createEntry(agent, off.id, { date: daysAgo(8) });
    await agent.patch(`/api/projects/${off.id}`).send({ reminderFrequency: 'OFF' });

    const archived = await createProject(agent);
    await createEntry(agent, archived.id, { date: daysAgo(8) });
    await agent.post(`/api/projects/${archived.id}/archive`);

    sendEmailMock.mockClear();
    await runSweep();

    expect(sendsTo(email)).toBe(0);
    const feed = await agent.get('/api/notifications');
    expect(feed.body.notifications).toHaveLength(0);
  });

  it('lets the global kill switch silence every project', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createEntry(agent, project.id, { date: daysAgo(8) });

    await agent.patch('/api/settings').send({ remindersEnabled: false });
    sendEmailMock.mockClear();

    await runSweep();

    expect(sendsTo(email)).toBe(0);
    const feed = await agent.get('/api/notifications');
    expect(feed.body.notifications).toHaveLength(0);
  });
});
