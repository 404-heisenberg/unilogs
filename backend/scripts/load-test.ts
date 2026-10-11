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
// The Sprint 4 endpoints (#351) are covered too: stat panels, the as-at view,
// entry history and offline sync. Seeded entries get the CREATE audit row a
// real create writes, so the as-at view reconstructs a realistic logbook.
//
// If the database has pg_stat_statements loaded, the run also counts the SQL
// statements one request to each endpoint issues, which is how an N+1 shows
// up. Start Postgres with shared_preload_libraries=pg_stat_statements (and
// pg_stat_statements.track_utility=off to leave out BEGIN/COMMIT) to get it.
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
const PANELS = 5;
const HISTORY_VERSIONS = 10;
const SYNC_BATCH = 10;

// Imported after DATABASE_URL is set, because both read it at import time.
const { createApp } = await import('../src/app.js');
const { auth, prisma } = await import('../src/auth.js');
const { toAuditData, toEntrySnapshot } = await import('../src/lib/audit-snapshot.js');

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
    // createMany skips the audit row POST /api/entries writes. Add it, so the
    // as-at view and history see what they would for a real logbook.
    const created = await prisma.entry.findMany({
      where: { projectId: project.id },
      select: { id: true, title: true, body: true, content: true, date: true },
    });
    await prisma.auditLog.createMany({
      data: created.map((entry) => ({
        entryId: entry.id,
        action: 'CREATE' as const,
        newData: toAuditData(toEntrySnapshot(entry)),
      })),
    });
  }
  return firstProjectId;
}

type Fixtures = { historyEntryId: number; syncBody: string };

// Stat panels on the first project, an entry edited through the API so it has
// a real history, and an offline sync batch to replay.
async function seedSprint4(cookie: string, userId: string, projectId: number): Promise<Fixtures> {
  await prisma.statPanel.createMany({
    data: Array.from({ length: PANELS }, (_, i) => ({
      userId,
      projectId,
      name: `Panel ${i + 1}`,
      expression: 'Hours',
      aggregation: i % 2 ? 'average' : 'sum',
      rangeDays: i % 2 ? 90 : 30,
      position: i,
    })),
  });

  const headers = { 'Content-Type': 'application/json', cookie };
  const create = await fetch(`${base}/api/entries`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ projectId, title: 'Edited entry', content: { Hours: 1 } }),
  });
  if (!create.ok) throw new Error(`Creating the history entry failed: ${create.status}`);
  const { id } = (await create.json()) as { id: number };
  for (let v = 2; v <= HISTORY_VERSIONS; v++) {
    const update = await fetch(`${base}/api/entries/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ title: `Edited entry v${v}` }),
    });
    if (!update.ok) throw new Error(`Editing the history entry failed: ${update.status}`);
  }

  // The same clientIds every time: the first request creates the entries and
  // every later one is the idempotent replay a reconnecting client sends.
  const syncBody = JSON.stringify({
    entries: Array.from({ length: SYNC_BATCH }, (_, i) => ({
      clientId: `load-sync-${i}`,
      projectId,
      date: new Date().toISOString(),
      title: `Offline entry ${i + 1}`,
      content: { Hours: 1 },
    })),
  });
  return { historyEntryId: id, syncBody };
}

type Target = { label: string; path: string; method?: 'GET' | 'POST'; body?: string };

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

function requestHeaders(cookie: string, body?: string): Record<string, string> {
  return body ? { cookie, 'content-type': 'application/json' } : { cookie };
}

async function hit(target: Target, cookie: string): Promise<Row> {
  const result = await autocannon({
    url: base + target.path,
    connections: CONNECTIONS,
    duration: DURATION,
    method: target.method ?? 'GET',
    body: target.body,
    headers: requestHeaders(cookie, target.body),
  });
  return {
    endpoint: target.label,
    requests: result.requests.total,
    rps: Math.round(result.requests.average),
    p50: result.latency.p50,
    p97_5: result.latency.p97_5,
    p99: result.latency.p99,
    errors: result.errors + result.timeouts,
    non2xx: result.non2xx,
  };
}

// SQL statements one request issues, read from pg_stat_statements. It sees
// every Prisma client, including any a route creates for itself. null when
// the extension isn't loaded.
async function statementsPerRequest(target: Target, cookie: string): Promise<number | null> {
  try {
    // executeRaw: the reset returns void, which $queryRaw can't deserialise.
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
    await prisma.$executeRawUnsafe('SELECT pg_stat_statements_reset()');
  } catch {
    return null;
  }
  const res = await fetch(base + target.path, {
    method: target.method ?? 'GET',
    headers: requestHeaders(cookie, target.body),
    body: target.body,
  });
  if (!res.ok) throw new Error(`${target.label} returned ${res.status}`);
  const [{ calls }] = await prisma.$queryRawUnsafe<{ calls: number }[]>(
    `SELECT COALESCE(SUM(calls), 0)::int AS calls FROM pg_stat_statements
     WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
       AND query NOT ILIKE '%pg_stat_statements%'`,
  );
  return calls;
}

let failed = false;
try {
  const cookie = await signIn();
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  console.log(`Seeding ${PROJECTS * ENTRIES_PER_PROJECT} entries...`);
  const projectId = await seed(user.id);
  const { historyEntryId, syncBody } = await seedSprint4(cookie, user.id, projectId);
  const today = new Date().toISOString().slice(0, 10);

  const targets: Target[] = [
    { label: 'GET /api/health', path: '/api/health' },
    { label: 'GET /api/projects', path: '/api/projects' },
    { label: 'GET /api/entries (page of 20)', path: '/api/entries?limit=20' },
    {
      label: 'GET /api/entries (search + date)',
      path: `/api/entries?q=chapter&dateFrom=${new Date(Date.now() - 90 * 86_400_000).toISOString()}`,
    },
    { label: 'GET /api/projects/:id/summary', path: `/api/projects/${projectId}/summary` },
    { label: 'GET /api/stats', path: '/api/stats' },
    { label: 'GET /api/stats/frequency', path: '/api/stats/frequency' },
    { label: 'GET /api/stats/streak', path: '/api/stats/streak' },
    { label: 'GET /api/stats/fields/:projectId', path: `/api/stats/fields/${projectId}` },
    // Sprint 4 (#351).
    {
      label: `GET /api/projects/:id/stat-panels (${PANELS} panels)`,
      path: `/api/projects/${projectId}/stat-panels`,
    },
    { label: 'GET /api/entries/as-at (whole logbook)', path: `/api/entries/as-at?date=${today}` },
    {
      label: `GET /api/entries/:id/history (${HISTORY_VERSIONS} versions)`,
      path: `/api/entries/${historyEntryId}/history`,
    },
    {
      label: `POST /api/entries/sync (${SYNC_BATCH} entries, replayed)`,
      path: '/api/entries/sync',
      method: 'POST',
      body: syncBody,
    },
  ];

  // Statement counts first, one request each on a quiet server. This also
  // makes the first sync request, so every load-test sync is a replay.
  const statements = new Map<string, number | null>();
  for (const target of targets) {
    statements.set(target.label, await statementsPerRequest(target, cookie));
  }

  const rows: Row[] = [];
  for (const target of targets) {
    console.log(`${target.label}: ${CONNECTIONS} connections for ${DURATION}s...`);
    rows.push(await hit(target, cookie));
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

  if ([...statements.values()].some((n) => n !== null)) {
    console.log('\nSQL statements per request (pg_stat_statements, one request each).\n');
    console.log('| Endpoint | Statements |');
    console.log('| --- | ---: |');
    for (const [label, n] of statements) console.log(`| ${label} | ${n} |`);
  } else {
    console.log('\npg_stat_statements is not loaded, so statements per request were skipped.');
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
