// Load test for the UniLogs API. Run with `npm run load-test`.
//
// Starts the real Express app on a random local port against the disposable
// test database (backend/.env.test, the same one `npm test` uses — never
// Neon), signs up a user through the real email-verification flow, seeds
// 50 projects x 500 entries (25,000 entries, the same volume as the
// benchmark on the Performance docs page), then drives each hot endpoint with
// concurrent connections and prints a Markdown table of the results. The
// seeded user is deleted at the end, even if the run fails.
//
// Options (environment variables):
//   LOAD_CONNECTIONS  concurrent connections per endpoint (default 50)
//   LOAD_DURATION     seconds per endpoint (default 20)
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { config } from 'dotenv';
import autocannon from 'autocannon';

config({ path: '.env.test', quiet: true });
process.env.NODE_ENV ??= 'test';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(testDatabaseUrl).pathname)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name');
}
// Same guard as vitest.config.ts: this script writes 25,000 rows.
process.env.DATABASE_URL = testDatabaseUrl;

const CONNECTIONS = Number(process.env.LOAD_CONNECTIONS ?? 50);
const DURATION = Number(process.env.LOAD_DURATION ?? 20);
const PROJECTS = 50;
const ENTRIES_PER_PROJECT = 500;

// Imported after DATABASE_URL is set, because both read it at import time.
const { createApp } = await import('../src/app.js');
const { auth, prisma } = await import('../src/auth.js');

const server = createApp().listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const email = `load-test-${randomUUID()}@example.test`;

async function signIn(): Promise<string> {
  const password = 'load-test-password-123';
  const signup = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Load Test' }),
  });
  if (!signup.ok) throw new Error(`Signup failed: ${signup.status}`);

  const { otp } = await auth.api.getVerificationOTP({
    query: { email, type: 'email-verification' },
  });
  if (!otp) throw new Error('No verification code was generated');

  const verify = await fetch(`${base}/api/auth/email-otp/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  if (!verify.ok) throw new Error(`Verification failed: ${verify.status}`);

  const cookie = verify.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  if (!cookie) throw new Error('Verification did not return a session cookie');
  return cookie;
}

async function seed(userId: string): Promise<number> {
  const now = Date.now();
  let firstProjectId = 0;
  for (let p = 0; p < PROJECTS; p++) {
    const project = await prisma.project.create({
      data: {
        name: `Load project ${p + 1}`,
        userId,
        fields: { create: [{ name: 'Hours', fieldType: 'duration' }] },
      },
    });
    firstProjectId ||= project.id;
    await prisma.entry.createMany({
      data: Array.from({ length: ENTRIES_PER_PROJECT }, (_, i) => ({
        projectId: project.id,
        // Spread across the previous year so date filters and stats windows
        // see realistic distributions.
        date: new Date(now - ((i * 7 + p) % 365) * 86_400_000),
        title: `Entry ${i + 1}`,
        body: 'Worked through the chapter and wrote up notes.',
        content: { Hours: (i % 8) / 2 + 0.5 },
      })),
    });
  }
  return firstProjectId;
}

type Row = {
  endpoint: string;
  requests: number;
  rps: number;
  p50: number;
  p97_5: number;
  p99: number;
  errors: number;
  non2xx: number;
};

async function hit(label: string, path: string, cookie: string): Promise<Row> {
  const result = await autocannon({
    url: base + path,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: { cookie },
  });
  return {
    endpoint: label,
    requests: result.requests.total,
    rps: Math.round(result.requests.average),
    p50: result.latency.p50,
    p97_5: result.latency.p97_5,
    p99: result.latency.p99,
    errors: result.errors + result.timeouts,
    non2xx: result.non2xx,
  };
}

let failed = false;
try {
  const cookie = await signIn();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  console.log(`Seeding ${PROJECTS * ENTRIES_PER_PROJECT} entries...`);
  const projectId = await seed(user.id);

  const targets: Array<[string, string]> = [
    ['GET /api/health', '/api/health'],
    ['GET /api/projects', '/api/projects'],
    ['GET /api/entries (page of 20)', '/api/entries?limit=20'],
    [
      'GET /api/entries (search + date)',
      `/api/entries?q=chapter&dateFrom=${new Date(Date.now() - 90 * 86_400_000).toISOString()}`,
    ],
    ['GET /api/projects/:id/summary', `/api/projects/${projectId}/summary`],
    ['GET /api/stats', '/api/stats'],
    ['GET /api/stats/frequency', '/api/stats/frequency'],
    ['GET /api/stats/streak', '/api/stats/streak'],
    ['GET /api/stats/fields/:projectId', `/api/stats/fields/${projectId}`],
  ];

  const rows: Row[] = [];
  for (const [label, path] of targets) {
    console.log(`${label}: ${CONNECTIONS} connections for ${DURATION}s...`);
    rows.push(await hit(label, path, cookie));
  }

  console.log(
    `\n${CONNECTIONS} concurrent connections, ${DURATION}s per endpoint, ` +
      `${PROJECTS * ENTRIES_PER_PROJECT} entries.\n`,
  );
  console.log('| Endpoint | Requests | Req/s | p50 | p97.5 | p99 | Errors | Non-2xx |');
  console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const r of rows) {
    console.log(
      `| ${r.endpoint} | ${r.requests} | ${r.rps} | ${r.p50} ms | ${r.p97_5} ms | ${r.p99} ms | ${r.errors} | ${r.non2xx} |`,
    );
    if (r.errors > 0 || r.non2xx > 0) failed = true;
  }
} finally {
  await prisma.user.deleteMany({ where: { email } });
  server.close();
  await prisma.$disconnect();
}

if (failed) {
  console.error('\nSome requests failed. See the Errors and Non-2xx columns.');
  process.exit(1);
}
