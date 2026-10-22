// Backdates the demo account's entries so the as-at view has a past to show.
//
// Why this is needed at all: the as-at view reconstructs the logbook by
// replaying the audit log, and it decides what existed at a moment from two
// timestamps - `entries.created_at` and `audit_logs.modified_at`. Both are
// `now` for anything written through the API, so every entry seeded today has
// the same timestamps, and an as-at query for any date before today returns
// an empty logbook. The API cannot set those columns, so the only way to
// seed a *historical* logbook is to write them directly.
//
// What it does, per entry:
//   * `entries.created_at` becomes the entry's own date - the entry was
//     created on the day it is dated
//   * the CREATE audit row gets that same timestamp
//   * later UPDATE rows move to the day after the entry, one day apart, so
//     an as-at view shows the pre-edit content first and the edited content
//     afterwards
//   * DELETE rows keep the time they really happened, because moving a
//     deletion into the past would hide the entry from days it was alive on
//
// Two ways to run it:
//
//   --sql    Read the plan through the API and print it as SQL statements.
//            This is the path to production that keeps the production
//            connection string off a developer machine: paste the statements
//            into the Neon SQL editor for the production branch. Nothing is
//            written by this script.
//
//   --apply  Read *and* write through the database. Needs DATABASE_URL to
//            point at the database being changed. Dry run unless --apply.
//
// Either way it only touches the demo account's four demo projects.
//
// Usage:
//   npm run backdate:demo -- --sql --email you@example.com
//   npm run backdate:demo -- --sql --email you@example.com --out backdate.sql
//   npm run backdate:demo -- --apply --email you@example.com
//
// Flags:
//   --sql         read the plan through the API and print it as SQL
//   --apply       read and write through the database
//   --email       the demo account's email
//   --password    the demo account's password (asked for, not echoed, if omitted)
//   --api         the API to read the plan from (default https://unilogs.onrender.com)
//   --out         write the SQL to this file instead of stdout (with --sql)
//
// Options (environment variables):
//   DEMO_API_URL   the API to read the plan from (default https://unilogs.onrender.com)
//   DEMO_EMAIL     the demo account's email (required)
//   DEMO_PASSWORD  the demo account's password (required for --sql)
//   DATABASE_URL   the database to read from (required for --apply)
//   DEMO_PROJECTS  comma separated project names (default: the four demo
//                  projects)

import { writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { credentials, flag } from './demo-account.js';

config({ quiet: true });

const asSql = process.argv.includes('--sql');
const apply = process.argv.includes('--apply');
const outFile = flag('out');

const API = (flag('api') ?? process.env.DEMO_API_URL ?? 'https://unilogs.onrender.com').replace(
  /\/+$/,
  '',
);

let EMAIL = '';
let PASSWORD = '';

if (apply && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required (load backend/.env, or set it for this run)');
}

const DEMO_PROJECTS = (
  process.env.DEMO_PROJECTS ?? 'Thesis Research,COMS3011A Project,Fitness Log,Reading List'
)
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

const NOW = Date.now();

/**
 * Progress and explanation go to stderr; stdout carries the SQL and nothing
 * else. That way `npx tsx scripts/backdate-demo-entries.ts --sql > backdate.sql`
 * writes a file the Neon SQL editor will accept.
 */
function note(message: string): void {
  console.error(message);
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

type Action = 'CREATE' | 'UPDATE' | 'DELETE';

/** One audit row. `auditId` is null when the row can only be identified by
 *  its entry and action - the DELETE row of a trashed entry, whose history
 *  the API will not serve. */
type PlanRow = { action: Action; modifiedAt: Date; auditId: number | null };

type PlanEntry = {
  id: number;
  title: string | null;
  date: Date;
  rows: PlanRow[];
};

/**
 * The timestamps to write for one entry's audit rows, in the order the rows
 * were written.
 */
function planTimes(entryDate: Date, rows: PlanRow[]): Date[] {
  const createAt = Math.min(entryDate.getTime(), NOW);
  const updateCount = rows.filter((row) => row.action === 'UPDATE').length;

  // How far apart the edited versions sit. A day apart reads well in the
  // as-at view - the logbook shows one thing on the day of the entry and
  // another on the day after - but it is squeezed when the entry is too
  // recent for that.
  let spacing = 86_400_000;
  if (updateCount > 0) {
    spacing = Math.min(spacing, Math.max(1_000, (NOW - createAt) / updateCount));
  }

  const times: number[] = [];
  let updateIndex = 0;
  let previous = createAt;
  let deleted = false;

  for (const row of rows) {
    let candidate: number;

    if (row.action === 'CREATE') {
      candidate = createAt;
    } else if (row.action === 'DELETE') {
      // The deletion happened when it happened. Moving it into the past
      // would hide the entry from days on which it was still alive.
      candidate = Math.max(row.modifiedAt.getTime(), previous + 1_000);
      deleted = true;
    } else if (deleted) {
      // An UPDATE after a DELETE is the restore. It has to stay after the
      // deletion, or the as-at view would still think the entry is gone.
      candidate = Math.max(row.modifiedAt.getTime(), previous + 1_000);
    } else {
      candidate = Math.max(createAt + ++updateIndex * spacing, previous + 1_000);
    }

    previous = candidate;
    times.push(candidate);
  }

  return times.map((time) => new Date(time));
}

/** The plan, with every timestamp decided. */
function buildPlan(entries: PlanEntry[]): { entries: PlanEntry[]; times: Map<number, Date[]> } {
  const times = new Map<number, Date[]>();
  for (const entry of entries) {
    times.set(entry.id, planTimes(entry.date, entry.rows));
  }
  return { entries, times };
}

// ---------------------------------------------------------------------------
// Reading the plan through the API
// ---------------------------------------------------------------------------

const jar = new Map<string, string>();

function captureCookies(res: Response): void {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];

  for (const cookie of raw) {
    const [pair] = cookie.split(';');
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  captureCookies(res);

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

type ApiProject = { id: number; name: string };
type ApiEntry = { id: number; date: string; title: string | null };
type ApiVersion = { auditId: number; action: Action; modifiedAt: string };
type ApiTrash = {
  entries: Array<{ id: number; date: string; title: string | null; deletedAt: string }>;
};

async function planFromApi(): Promise<PlanEntry[]> {
  await api('POST', '/api/auth/signin', { email: EMAIL, password: PASSWORD });

  const projects = await api<ApiProject[]>('GET', '/api/projects');
  const chosen = DEMO_PROJECTS.map((name) => {
    const project = projects.find((candidate) => candidate.name === name);
    if (!project) throw new Error(`No project named "${name}" on the demo account`);
    return project;
  });

  const entries: PlanEntry[] = [];

  for (const project of chosen) {
    const live = await api<{ entries: ApiEntry[] }>(
      'GET',
      `/api/entries?projectId=${project.id}&limit=100`,
    );

    for (const entry of live.entries) {
      const history = await api<{ versions: ApiVersion[] }>(
        'GET',
        `/api/entries/${entry.id}/history`,
      );

      // The API serves the newest row first; audit ids increase with the
      // write order, so sorting by id puts the rows back in the order they
      // were written.
      const rows = [...history.versions]
        .sort((left, right) => left.auditId - right.auditId)
        .map((version) => ({
          action: version.action,
          modifiedAt: new Date(version.modifiedAt),
          auditId: version.auditId,
        }));

      entries.push({ id: entry.id, title: entry.title, date: new Date(entry.date), rows });
    }

    const trash = await api<ApiTrash>('GET', `/api/projects/${project.id}/trash`);

    for (const entry of trash.entries) {
      // The history route refuses a soft-deleted entry, so the DELETE row
      // cannot be read. Its timestamp is the moment of the deletion, which is
      // the same transaction that stamped `deletedAt`.
      const rows: PlanRow[] = [
        { action: 'CREATE', modifiedAt: new Date(entry.date), auditId: null },
        { action: 'DELETE', modifiedAt: new Date(entry.deletedAt), auditId: null },
      ];

      entries.push({ id: entry.id, title: entry.title, date: new Date(entry.date), rows });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Reading the plan from the database
// ---------------------------------------------------------------------------

async function planFromDatabase(): Promise<PlanEntry[]> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) {
      throw new Error(`No account with the email ${EMAIL}`);
    }

    const projects = await prisma.project.findMany({
      where: { userId: user.id, name: { in: DEMO_PROJECTS } },
      select: { id: true, name: true },
    });

    const found = new Set(projects.map((project) => project.name));
    const missing = DEMO_PROJECTS.filter((name) => !found.has(name));
    if (missing.length) {
      console.warn(`No such project(s): ${missing.join(', ')}`);
    }

    const rows = await prisma.entry.findMany({
      where: { projectId: { in: projects.map((project) => project.id) } },
      include: {
        project: { select: { name: true } },
        auditLogs: { orderBy: { id: 'asc' } },
      },
    });

    return rows.map((entry) => ({
      id: entry.id,
      title: entry.title,
      date: entry.date,
      rows: entry.auditLogs.map((row) => ({
        action: row.action,
        modifiedAt: row.modifiedAt,
        auditId: row.id,
      })),
    }));
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function sqlFor(entries: PlanEntry[], times: Map<number, Date[]>): string[] {
  const statements: string[] = [];

  for (const entry of entries) {
    const entryTimes = times.get(entry.id)!;

    statements.push(
      `UPDATE entries SET "createdAt" = '${entryTimes[0].toISOString()}'::timestamptz WHERE id = ${entry.id};`,
    );

    entry.rows.forEach((row, index) => {
      const when = entryTimes[index].toISOString();

      if (row.auditId !== null) {
        statements.push(
          `UPDATE audit_logs SET "modifiedAt" = '${when}'::timestamptz WHERE id = ${row.auditId};`,
        );
        return;
      }

      // A row that could not be read through the API. One CREATE and one
      // DELETE per entry is a safe thing to name by action.
      statements.push(
        `UPDATE audit_logs SET "modifiedAt" = '${when}'::timestamptz WHERE "entryId" = ${entry.id} AND action = '${row.action}';`,
      );
    });
  }

  return statements;
}

async function main(): Promise<void> {
  if (asSql) {
    const creds = await credentials();
    EMAIL = creds.email;
    PASSWORD = creds.password;
  } else {
    EMAIL = flag('email') ?? process.env.DEMO_EMAIL ?? '';
    if (!EMAIL) {
      throw new Error('No demo account email. Pass --email you@example.com, or set DEMO_EMAIL.');
    }
  }

  const entries = asSql ? await planFromApi() : await planFromDatabase();
  const { times } = buildPlan(entries);

  const auditCount = entries.reduce((total, entry) => total + entry.rows.length, 0);

  note(`account:  ${EMAIL}`);
  note(`projects: ${DEMO_PROJECTS.join(', ')}`);
  note(
    `mode:     ${asSql ? 'SQL (print statements, write nothing)' : apply ? 'APPLY' : 'dry run (pass --apply to write)'}`,
  );
  note(`entries:  ${entries.length}`);
  note(`audit:    ${auditCount}`);
  note('');

  if (asSql) {
    const statements = sqlFor(entries, times);
    const sql = ['BEGIN;', ...statements, 'COMMIT;'].join('\n') + '\n';

    if (outFile) {
      // Writing the file directly beats piping stdout into one. `npm run`
      // prints its own banner to stdout, so a redirect lands the banner in
      // the file as well, and the Neon editor will not accept it.
      writeFileSync(outFile, sql, 'utf8');
      note(`wrote ${statements.length} statements to ${outFile}`);
    } else {
      // The SQL goes to stdout on its own so it can be piped to a file and
      // pasted into the Neon SQL editor without any prose in the way. The
      // explanation goes to stderr.
      process.stdout.write(sql);
    }

    note('');
    note(`${statements.length} statements, in one transaction.`);
    note('Paste the block into the Neon SQL editor for the production branch.');
    note('One transaction, so a failure halfway leaves the tables as they were.');
    return;
  }

  for (const entry of entries.slice(0, 5)) {
    const entryTimes = times.get(entry.id)!;
    note(`  ${entry.title ?? '(untitled)'}`);
    note(`    date        ${entry.date.toISOString()}`);
    note(`    created_at  -> ${entryTimes[0].toISOString()}`);
  }
  note('');

  if (!apply) {
    note('dry run: nothing was written.');
    note('');
    note('To write, run the same command with --apply.');
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const missingIds = entries.flatMap((entry) =>
      entry.rows.filter((row) => row.auditId === null).map((row) => row.action),
    );
    if (missingIds.length) {
      throw new Error(
        `Some audit rows have no id (${missingIds.join(', ')}). Use --sql and paste the statements instead.`,
      );
    }

    // The default 5s transaction timeout is measured client-side and each
    // statement is a round trip to Neon, which is enough to overrun it and
    // roll the whole thing back. 60s for a one-off script.
    const writes = [
      ...entries.map((entry) =>
        prisma.entry.update({
          where: { id: entry.id },
          data: { createdAt: times.get(entry.id)![0] },
        }),
      ),
      ...entries.flatMap((entry) =>
        entry.rows.map((row, index) =>
          prisma.auditLog.update({
            where: { id: row.auditId! },
            data: { modifiedAt: times.get(entry.id)![index] },
          }),
        ),
      ),
    ];

    await prisma.$transaction(writes, { timeout: 60_000, maxWait: 15_000 });
    note(`applied: ${entries.length} entries and ${auditCount} audit rows backdated.`);
  } catch (err) {
    console.error(`NOT APPLIED: the transaction rolled back. ${String(err)}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\nFailed: ${(err as Error).message}`);
  process.exit(1);
});
