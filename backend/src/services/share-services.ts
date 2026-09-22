import { randomUUID } from 'node:crypto';
import { prisma } from '../auth.js';
import type { ShareToken } from '../generated/prisma/client.js';

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
