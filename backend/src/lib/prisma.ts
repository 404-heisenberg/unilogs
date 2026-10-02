import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

// The one database client for the whole API. Every route, service and Better
// Auth share it, so the process holds a single connection pool. Before this,
// each route file created its own client and pool (up to 10 connections
// each), which under load could exhaust Neon's connection limit.
//
// DATABASE_POOL_MAX raises the pool size if a deployment needs it; pg's
// default of 10 is plenty for the free tier.
//
// Never construct a second `new PrismaClient()` here or anywhere else. The
// opt-out client below is the same instance, not a new pool.
const prismaWithDeleted = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  }),
});

// Entries are soft-deleted: `DELETE /api/entries/:id` stamps `Entry.deletedAt`
// instead of removing the row, so the deletion can be undone from the project
// trash. Every read has to hide those rows, or a deleted entry keeps counting
// toward stats, exports, shared reports and dashboard totals.
//
// Doing that with per-query discipline means one forgotten `where` clause is a
// silent data bug, so the exclusion lives in a query extension instead: the
// `entry` reads below add `deletedAt: null` to whatever the caller passed.
//
// Two limits worth knowing before you trust this:
//
// 1. Extensions only intercept top-level operations on the model. A nested
//    relation load (`project.findFirst({ include: { entries } })`) is not
//    filtered by this, so those call sites filter `deletedAt` themselves - see
//    services/project-summary-service.ts. The same goes for raw SQL: see the
//    `$queryRaw` in utils/stats-helper.ts.
// 2. Only reads are extended. Writes are untouched on purpose: the restore
//    routes need to reach a soft-deleted row, and there is no read of a
//    deleted entry that a write depends on.
//
// `prismaWithDeleted` is the escape hatch for the trash, the history and the
// as-at views. It shares this exact client - `$extends` wraps the same engine,
// so there is still only one connection pool.
const excludeSoftDeleted = Prisma.defineExtension({
  name: 'exclude-soft-deleted-entries',
  query: {
    entry: {
      async findMany({ args, query }) {
        return query({ ...args, where: withLiveEntries(args.where) });
      },
      async findFirst({ args, query }) {
        return query({ ...args, where: withLiveEntries(args.where) });
      },
      async findUnique({ args, query }) {
        // `where` on findUnique must keep its unique field, so this composes
        // rather than wraps - hence `satisfies` rather than a plain cast.
        const where = {
          ...args.where,
          deletedAt: null,
        } satisfies Prisma.EntryWhereUniqueInput;
        return query({ ...args, where });
      },
      async count({ args, query }) {
        return query({ ...args, where: withLiveEntries(args.where) });
      },
      async aggregate({ args, query }) {
        return query({ ...args, where: withLiveEntries(args.where) });
      },
      async groupBy({ args, query }) {
        return query({ ...args, where: withLiveEntries(args.where) });
      },
    },
  },
});

function withLiveEntries(where?: Prisma.EntryWhereInput): Prisma.EntryWhereInput {
  if (!where) return { deletedAt: null };
  return { AND: [where, { deletedAt: null }] };
}

export { prismaWithDeleted };

// The default client: reads exclude soft-deleted entries.
export const prisma = prismaWithDeleted.$extends(excludeSoftDeleted);
