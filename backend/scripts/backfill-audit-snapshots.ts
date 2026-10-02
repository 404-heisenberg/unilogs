// One-time backfill: trim existing `audit_logs` snapshots to the five values a
// version actually needs. Run with `npm run backfill:audit-snapshots -- --apply`.
//
// Why: audit rows were written as `JSON.parse(JSON.stringify(entry))` on an
// entry fetched *with its project*, so every version of every entry carried a
// copy of the project's field definitions. New writes are trimmed
// (src/lib/audit-snapshot.ts); this rewrites the rows that predate it.
//
// This is a script rather than a migration on purpose. Reshaping JSON is not
// something SQL does well, and a migration would also run against the
// disposable test database and production, where there is nothing to backfill.
// The database's own point-in-time restore is the safety net if this goes
// wrong; the script is written to be safe on its own terms too:
//
//   * Default is a dry run. Without `--apply` it reads, verifies and reports.
//   * Every rewrite is verified against the original before anything is
//     written: the five trimmed values must deep-equal what the old row held,
//     and a row whose values cannot be recovered is reported and skipped rather
//     than approximated.
//   * The writes happen in one transaction, so a failure halfway leaves the
//     table exactly as it was.
//
// It prints the database host it is about to touch. Check it is the dev
// database before passing `--apply`.
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

config({ quiet: true });

const apply = process.argv.includes('--apply');

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is required (load backend/.env)');
}

const host = new URL(url).hostname;
const database = new URL(url).pathname.replace(/^\//, '');

type Row = {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldData: Prisma.JsonValue | null;
  newData: Prisma.JsonValue | null;
};

type Trimmed = Record<string, unknown>;

function asRecord(value: unknown): Trimmed | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Trimmed;
}

/**
 * Already trimmed: none of the keys that only the old, bloated snapshots
 * carried. Keyed on the bloat rather than on `tagIds` because a snapshot
 * written from an entry fetched without its tags has no `tagIds` key at all -
 * checking for that key would re-report those rows on every run forever.
 */
const BLOAT_KEYS = ['id', 'projectId', 'createdAt', 'project', 'tags'];

function isTrimmed(record: Trimmed): boolean {
  return BLOAT_KEYS.every((key) => !(key in record));
}

function trim(record: Trimmed): Trimmed | null {
  if (!('content' in record)) return null;

  const trimmed: Trimmed = {
    title: typeof record.title === 'string' ? record.title : null,
    body: typeof record.body === 'string' ? record.body : null,
    content: record.content ?? {},
    date: typeof record.date === 'string' ? record.date : null,
  };

  // A row whose tags were never loaded keeps no tagIds key: absent means
  // "unknown", and writing `[]` would claim the entry had no tags.
  if (Array.isArray(record.tags)) {
    trimmed.tagIds = record.tags
      .map((tag) => asRecord(tag))
      .filter((tag): tag is Trimmed => tag !== null)
      .map((tag) => tag.tagId)
      .filter((id): id is number => typeof id === 'number');
  } else if ('tagIds' in record) {
    trimmed.tagIds = record.tagIds as number[];
  }

  return trimmed;
}

/** The lossless check: nothing we keep may differ from what was stored. */
function matches(record: Trimmed, trimmed: Trimmed): boolean {
  for (const key of ['title', 'body', 'content', 'date'] as const) {
    if (JSON.stringify(record[key] ?? null) !== JSON.stringify(trimmed[key] ?? null)) {
      return false;
    }
  }

  if (Array.isArray(record.tags) && 'tagIds' in trimmed) {
    const expected = record.tags
      .map((tag) => asRecord(tag))
      .filter((tag): tag is Trimmed => tag !== null)
      .map((tag) => tag.tagId)
      .filter((id): id is number => typeof id === 'number');
    if (JSON.stringify(expected) !== JSON.stringify(trimmed.tagIds)) return false;
  }

  return true;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const rows = await prisma.auditLog.findMany({
  select: { id: true, action: true, oldData: true, newData: true },
});

const updates: { id: number; oldData?: Trimmed; newData?: Trimmed }[] = [];
const skipped: number[] = [];
let spotCheck: { id: number; before: unknown; after: unknown } | null = null;

for (const row of rows as Row[]) {
  const patch: { id: number; oldData?: Trimmed; newData?: Trimmed } = { id: row.id };
  let changed = false;

  for (const column of ['oldData', 'newData'] as const) {
    const record = asRecord(row[column]);
    if (!record) continue;
    if (isTrimmed(record)) continue;

    const trimmed = trim(record);
    if (!trimmed || !matches(record, trimmed)) {
      skipped.push(row.id);
      continue;
    }

    patch[column] = trimmed;
    changed = true;

    if (!spotCheck) {
      spotCheck = { id: row.id, before: record, after: trimmed };
    }
  }

  if (changed) updates.push(patch);
}

const bytesBefore = Buffer.byteLength(JSON.stringify(rows));
const bytesAfter = Buffer.byteLength(JSON.stringify(updates));

console.log(`database: ${host}/${database}`);
console.log(`mode:     ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
console.log(`rows:     ${rows.length}`);
console.log(`rewrite:  ${updates.length}`);
console.log(
  `skipped:  ${skipped.length}${skipped.length ? ` (ids: ${skipped.slice(0, 10).join(', ')})` : ''}`,
);
console.log(`size:     ${formatBytes(bytesBefore)} -> ${formatBytes(bytesAfter)}`);
console.log('');

if (spotCheck) {
  console.log('spot check on the first rewritten row');
  console.log(`  row ${spotCheck.id}`);
  console.log(`  before: ${JSON.stringify(spotCheck.before).slice(0, 240)}`);
  console.log(`  after:  ${JSON.stringify(spotCheck.after)}`);
  console.log('');
}

if (!apply) {
  console.log('dry run: nothing was written.');
} else if (skipped.length > 0) {
  console.log('NOT APPLIED: some rows could not be trimmed losslessly.');
} else if (updates.length === 0) {
  console.log('applied: nothing to do.');
} else {
  try {
    // The default 5s transaction timeout is measured client-side and each
    // statement is a round trip to Neon, which is enough to overrun it and roll
    // the whole thing back. 60s for a one-off script.
    await prisma.$transaction(
      updates.map((patch) =>
        prisma.auditLog.update({
          where: { id: patch.id },
          data: {
            ...(patch.oldData !== undefined ? { oldData: patch.oldData as never } : {}),
            ...(patch.newData !== undefined ? { newData: patch.newData as never } : {}),
          },
        }),
      ),
      { timeout: 60_000, maxWait: 15_000 },
    );
    console.log(`applied: ${updates.length} rows rewritten.`);
  } catch (error) {
    // One transaction means a failure here leaves the table untouched.
    console.log(`NOT APPLIED: the transaction rolled back. ${String(error)}`);
  }
}

await prisma.$disconnect();

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
