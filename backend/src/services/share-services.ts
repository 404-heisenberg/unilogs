import { randomUUID } from 'node:crypto';
import { prisma } from '../auth.js';
import type { ShareToken } from '../generated/prisma/client.js';
import { buildProjectSummary } from './project-summary-service.js';
import { buildFieldInsights } from './stats-services.js';

const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_EXPIRY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CreateShareTokenOptions = {
  includeBodies?: boolean;
  defaultRangeDays?: number;
  expiresInDays?: number;
};

export async function createShareToken(
  projectId: number,
  options: CreateShareTokenOptions = {},
): Promise<ShareToken> {
  const expiresInDays = options.expiresInDays ?? DEFAULT_EXPIRY_DAYS;

  return prisma.shareToken.create({
    data: {
      token: randomUUID(),
      projectId,
      expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
      includeBodies: options.includeBodies ?? false,
      defaultRangeDays: options.defaultRangeDays ?? DEFAULT_RANGE_DAYS,
    },
  });
}

// The token is the auth, so this is the single gate the public routes use:
// unknown, revoked and expired all return null and must be indistinguishable.
export async function verifyShareToken(token: string): Promise<ShareToken | null> {
  const share = await prisma.shareToken.findUnique({ where: { token } });

  if (!share || share.revokedAt || share.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return share;
}

export async function revokeShareToken(projectId: number, token: string): Promise<number> {
  const result = await prisma.shareToken.updateMany({
    where: { projectId, token, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count;
}

// Called when a project is deleted (B-02) so a dead project can never keep
// serving a public link. Soft-revokes every live token; idempotent.
export async function revokeProjectShares(projectId: number): Promise<number> {
  const result = await prisma.shareToken.updateMany({
    where: { projectId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count;
}

export type ShareReportOptions = {
  // Never caller-supplied on the export route: the token owns the range, so an
  // export request cannot widen what the link was created to expose.
  rangeDays?: number;
  tagIds?: number[];
};

// Builds the read-only payload a public share link serves. The token is already
// verified by the caller, so this only assembles data. Returns null when the
// project no longer exists (defence in depth - the FK cascade normally prevents
// this), so the route can answer with the same 404 as a dead token.
export async function buildShareReport(share: ShareToken, options: ShareReportOptions = {}) {
  const project = await prisma.project.findUnique({
    where: { id: share.projectId },
    select: { id: true, name: true, description: true, userId: true },
  });

  if (!project) {
    return null;
  }

  const rangeDays = options.rangeDays ?? share.defaultRangeDays;
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - rangeDays * DAY_MS);

  const fields = await prisma.fieldDefinition.findMany({
    where: { projectId: project.id },
    select: { name: true, fieldType: true },
  });

  const entries = await prisma.entry.findMany({
    where: {
      projectId: project.id,
      date: { gte: dateFrom, lte: dateTo },
      ...(options.tagIds && options.tagIds.length > 0
        ? { tags: { some: { tagId: { in: options.tagIds } } } }
        : {}),
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    include: { tags: { include: { tag: { select: { name: true } } } } },
  });

  const [summary, insights] = await Promise.all([
    buildProjectSummary(project.userId, project.id),
    buildFieldInsights(project.id, project.userId),
  ]);

  return {
    project: { id: project.id, name: project.name, description: project.description },
    includeBodies: share.includeBodies,
    rangeDays,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    fields,
    summary,
    insights,
    entries: entries.map((entry) => {
      const base = {
        id: entry.id,
        date: entry.date,
        title: entry.title,
        content: entry.content,
        tags: entry.tags.map((entryTag) => entryTag.tag.name),
      };

      return share.includeBodies ? { ...base, body: entry.body } : base;
    }),
  };
}
