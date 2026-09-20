import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function getDistinctEntryDates(userId: string): Promise<string[]> {
  // Only the distinct days matter for the streak, so let Postgres collapse the
  // rows instead of shipping every entry date to the app and de-duplicating in
  // JS. `date` is TIMESTAMP(3), so to_char returns the same calendar day that
  // the previous `toISOString().split('T')[0]` produced.
  const rows = await prisma.$queryRaw<{ day: string }[]>`
    SELECT DISTINCT to_char(e.date, 'YYYY-MM-DD') AS day
    FROM entries e
    JOIN projects p ON p.id = e."projectId"
    WHERE p."userId" = ${userId} AND p.archived = false
  `;

  return rows.map((row) => row.day);
}

export async function computeCurrentStreak(userId: string): Promise<number> {
  const dateSet = await getDistinctEntryDates(userId);

  if (dateSet.length === 0) {
    return 0;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let endDateStr: string;
  if (dateSet.includes(todayStr)) {
    endDateStr = todayStr;
  } else if (dateSet.includes(yesterdayStr)) {
    endDateStr = yesterdayStr;
  } else {
    return 0;
  }

  let streak = 0;
  const currentDate = new Date(endDateStr);

  while (true) {
    const dateStr = currentDate.toISOString().split('T')[0];
    if (dateSet.includes(dateStr)) {
      streak++;
      currentDate.setUTCDate(currentDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
