import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAuthenticatedUser,
  createEntry,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
} from './helpers/api.js';

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn(async () => true) }));

vi.mock('../src/services/email-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/email-service.js')>();
  return { ...actual, sendEmail: sendEmailMock };
});

import { buildDigestFor, sendDueDigests, windowDaysFor } from '../src/services/reminder-service.js';

afterEach(async () => {
  sendEmailMock.mockClear();
  await deleteTestUsers();
});
afterAll(disconnectTestDatabase);

describe('windowDaysFor', () => {
  it('maps each frequency to its reminder window', () => {
    expect(windowDaysFor('DAILY')).toBe(1);
    expect(windowDaysFor('WEEKLY')).toBe(7);
    expect(windowDaysFor('OFF')).toBeNull();
  });
});

describe('buildDigestFor', () => {
  it('counts entries inside the window and composes the digest', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent, { name: 'Thesis' });
    const today = new Date().toISOString().slice(0, 10);
    await createEntry(agent, project.id, { date: today });
    await createEntry(agent, project.id, { date: today });

    const digest = await buildDigestFor({ id: project.id, name: project.name }, 7);

    expect(digest.entryCount).toBe(2);
    expect(digest.subject).toContain('Thesis');
    expect(digest.html).toContain('2 entries');
  });
});

describe('sendDueDigests', () => {
  it('sends one digest for an enabled WEEKLY recipient', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    sendEmailMock.mockClear();

    const sent = await sendDueDigests([
      {
        email,
        project: { id: project.id, name: project.name },
        frequency: 'WEEKLY',
        remindersEnabled: true,
      },
    ]);

    expect(sent).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      email,
      expect.stringContaining(project.name),
      expect.any(String),
    );
  });

  it('never sends for an OFF project', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    sendEmailMock.mockClear();

    const sent = await sendDueDigests([
      {
        email,
        project: { id: project.id, name: project.name },
        frequency: 'OFF',
        remindersEnabled: true,
      },
    ]);

    expect(sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('lets the global kill switch beat a due project', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    sendEmailMock.mockClear();

    const sent = await sendDueDigests([
      {
        email,
        project: { id: project.id, name: project.name },
        frequency: 'DAILY',
        remindersEnabled: false,
      },
    ]);

    expect(sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
