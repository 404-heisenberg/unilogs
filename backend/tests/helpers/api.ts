import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import request from 'supertest';
import { auth } from '../../src/auth.js';

const testEmailPrefix = 'test-api-';

let appPromise: Promise<ReturnType<(typeof import('../../src/app.js'))['createApp']>> | undefined;
let cleanupPrisma: PrismaClient | undefined;

type TestAgent = ReturnType<typeof request.agent>;

type ProjectInput = {
  name?: string;
  description?: string | null;
};

export type AuthenticatedUser = {
  agent: TestAgent;
  email: string;
  password: string;
};

async function getApp() {
  appPromise ??= import('../../src/app.js').then(({ createApp }) => createApp());
  return appPromise;
}

function getCleanupPrisma() {
  cleanupPrisma ??= new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    }),
  });

  return cleanupPrisma;
}

export async function getApiClient() {
  return request(await getApp());
}

export async function createAuthenticatedUser(): Promise<AuthenticatedUser> {
  const email = `${testEmailPrefix}${randomUUID()}@example.test`;
  const password = 'test-password-123';
  const agent = request.agent(await getApp());

  const signup = await agent.post('/api/auth/signup').send({
    email,
    password,
    name: 'Test User',
  });

  if (signup.status >= 400) {
    throw new Error(`Test signup failed with status ${signup.status}`);
  }

  // Signup no longer creates a session (email verification is required before
  // sign-in) - complete the same OTP flow a real user would, using the
  // server-only lookup to read the code without going through email.
  const { otp } = await auth.api.getVerificationOTP({
    query: { email, type: 'email-verification' },
  });
  if (!otp) {
    throw new Error('Test signup did not produce a verification OTP');
  }

  const verify = await agent.post('/api/auth/email-otp/verify-email').send({ email, otp });
  if (verify.status !== 200) {
    throw new Error(`Test email verification failed with status ${verify.status}`);
  }

  return { agent, email, password };
}

export async function createProject(agent: TestAgent, input: ProjectInput = {}) {
  const response = await agent.post('/api/projects').send({
    name: input.name ?? `Project ${randomUUID()}`,
    description: input.description,
  });

  if (response.status !== 201) {
    throw new Error(`Test project creation failed with status ${response.status}`);
  }

  return response.body;
}

type FieldDefinitionInput = {
  name?: string;
  fieldType?: string;
};

export async function createFieldDefinition(
  agent: TestAgent,
  projectId: number,
  input: FieldDefinitionInput = {},
) {
  const response = await agent.post('/api/field-definitions').send({
    projectId,
    name: input.name ?? 'Hours',
    fieldType: input.fieldType ?? 'number',
  });

  if (response.status !== 201) {
    throw new Error(`Test field definition creation failed with status ${response.status}`);
  }

  return response.body;
}

type EntryInput = {
  date?: string;
  content?: Record<string, unknown>;
};

export async function createEntry(agent: TestAgent, projectId: number, input: EntryInput = {}) {
  const response = await agent.post('/api/entries').send({
    projectId,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    content: input.content ?? {},
  });

  if (response.status !== 201) {
    throw new Error(`Test entry creation failed with status ${response.status}`);
  }

  return response.body;
}

export async function deleteTestUsers() {
  await getCleanupPrisma().user.deleteMany({
    where: {
      email: {
        startsWith: testEmailPrefix,
      },
    },
  });
}

export async function disconnectTestDatabase() {
  await cleanupPrisma?.$disconnect();

  const { prisma } = await import('../../src/auth.js');
  await prisma.$disconnect();
}
