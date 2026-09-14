import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createAuthenticatedUser,
  createFieldDefinition,
  createProject,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

// Accept/reject never call Google or Better Auth — they only touch our own
// database (create an entry, record a CalendarSuggestion) — so unlike
// calendar.google.api.test.ts, nothing here needs mocking.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

afterEach(deleteTestUsers);
afterAll(async () => {
  await prisma.$disconnect();
  await disconnectTestDatabase();
});

describe('POST /api/calendar/events/suggestions/:eventId/accept', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api
      .post('/api/calendar/events/suggestions/evt-1/accept')
      .send({ projectId: 1, content: {} });
    expect(response.status).toBe(401);
  });

  it('requires projectId and content', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent.post('/api/calendar/events/suggestions/evt-1/accept').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'projectId and content are required' });
  });

  it('rejects a non-numeric projectId', async () => {
    const { agent } = await createAuthenticatedUser();

    const response = await agent
      .post('/api/calendar/events/suggestions/evt-1/accept')
      .send({ projectId: 'not-a-number', content: { Notes: 'x' } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'projectId must be a valid integer' });
  });

  it("rejects a project the user doesn't own", async () => {
    const { agent } = await createAuthenticatedUser();
    const other = await createAuthenticatedUser();
    const otherProject = await createProject(other.agent);

    const response = await agent
      .post('/api/calendar/events/suggestions/evt-1/accept')
      .send({ projectId: otherProject.id, content: {} });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'You do not have access to this project' });
  });

  it('rejects content that fails field validation', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createFieldDefinition(agent, project.id, { name: 'Notes', fieldType: 'text' });

    const response = await agent
      .post('/api/calendar/events/suggestions/evt-1/accept')
      .send({ projectId: project.id, content: {} });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ errors: ["Field 'Notes' is required"] });
  });

  it('creates an entry and records the suggestion as accepted', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createFieldDefinition(agent, project.id, { name: 'Notes', fieldType: 'text' });
    const eventId = `evt-${randomUUID()}`;

    const response = await agent.post(`/api/calendar/events/suggestions/${eventId}/accept`).send({
      projectId: project.id,
      content: { Notes: 'From calendar' },
      date: '2026-09-11',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        projectId: project.id,
        content: { Notes: 'From calendar' },
      }),
    );

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const suggestion = await prisma.calendarSuggestion.findUnique({
      where: { userId_eventId: { userId: user.id, eventId } },
    });
    expect(suggestion?.status).toBe('ACCEPTED');
  });

  it('rejects accepting the same event twice', async () => {
    const { agent } = await createAuthenticatedUser();
    const project = await createProject(agent);
    await createFieldDefinition(agent, project.id, { name: 'Notes', fieldType: 'text' });
    const eventId = `evt-${randomUUID()}`;
    const body = { projectId: project.id, content: { Notes: 'From calendar' } };

    const first = await agent.post(`/api/calendar/events/suggestions/${eventId}/accept`).send(body);
    const second = await agent
      .post(`/api/calendar/events/suggestions/${eventId}/accept`)
      .send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(500);
  });
});

describe('POST /api/calendar/events/suggestions/:eventId/reject', () => {
  it('rejects unauthenticated requests', async () => {
    const api = await getApiClient();
    const response = await api.post('/api/calendar/events/suggestions/evt-1/reject');
    expect(response.status).toBe(401);
  });

  it('records the suggestion as rejected', async () => {
    const { agent, email } = await createAuthenticatedUser();
    const eventId = `evt-${randomUUID()}`;

    const response = await agent.post(`/api/calendar/events/suggestions/${eventId}/reject`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Calendar suggestion rejected' });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const suggestion = await prisma.calendarSuggestion.findUnique({
      where: { userId_eventId: { userId: user.id, eventId } },
    });
    expect(suggestion?.status).toBe('REJECTED');
  });

  it('rejects rejecting the same event twice', async () => {
    const { agent } = await createAuthenticatedUser();
    const eventId = `evt-${randomUUID()}`;

    const first = await agent.post(`/api/calendar/events/suggestions/${eventId}/reject`);
    const second = await agent.post(`/api/calendar/events/suggestions/${eventId}/reject`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(500);
  });
});
